import { lookup as dnsLookup } from 'node:dns/promises';
import ipaddr from 'ipaddr.js';

/**
 * SSRF protection for outbound requests to user-supplied URLs.
 * Only globally routable unicast addresses on ports 80/443 are allowed.
 * The vetted address is then pinned for the actual connection, so a DNS
 * answer cannot change between validation and connection (DNS rebinding).
 */

export class BlockedDestinationError extends Error {
  constructor(readonly reason: string) {
    super(reason);
    this.name = 'BlockedDestinationError';
  }
}

const BLOCKED_HOSTNAMES = [
  /^localhost$/i,
  /\.localhost$/i,
  /\.local$/i,
  /\.internal$/i,
  /\.lan$/i,
  /\.home\.arpa$/i,
  /\.intranet$/i,
  /^metadata(\.google\.internal)?$/i,
  /^instance-data$/i,
];

export const ALLOWED_PORTS = new Set([80, 443]);

/** True only for public, globally routable unicast addresses. */
export function isPublicAddress(address: string): boolean {
  if (!ipaddr.isValid(address)) return false;
  let parsed = ipaddr.parse(address);
  if (parsed.kind() === 'ipv6') {
    const v6 = parsed as ipaddr.IPv6;
    if (v6.isIPv4MappedAddress()) parsed = v6.toIPv4Address();
  }
  return parsed.range() === 'unicast';
}

export function assertHostnameAllowed(hostname: string): void {
  const h = hostname.replace(/^\[|\]$/g, '');
  if (BLOCKED_HOSTNAMES.some((re) => re.test(h))) {
    throw new BlockedDestinationError('internal hostname');
  }
  if (!h.includes('.') && !ipaddr.isValid(h))
    throw new BlockedDestinationError('single-label hostname');
}

export function assertPortAllowed(url: URL): void {
  const port = url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80;
  if (!ALLOWED_PORTS.has(port)) throw new BlockedDestinationError(`port ${port} not allowed`);
}

export type Resolver = (hostname: string) => Promise<Array<{ address: string; family: number }>>;

export const systemResolver: Resolver = (hostname) =>
  dnsLookup(hostname, { all: true, verbatim: true });

export interface VettedDestination {
  hostname: string;
  address: string;
  family: 4 | 6;
}

/**
 * Resolve a hostname and require that EVERY returned address is public.
 * (If any record points inward we refuse — an attacker controls which one is used.)
 */
export async function resolveAndVet(
  hostname: string,
  resolver: Resolver,
): Promise<VettedDestination> {
  const h = hostname.replace(/^\[|\]$/g, '');
  assertHostnameAllowed(h);
  if (ipaddr.isValid(h)) {
    if (!isPublicAddress(h)) throw new BlockedDestinationError('non-public IP address');
    return { hostname: h, address: h, family: ipaddr.parse(h).kind() === 'ipv6' ? 6 : 4 };
  }
  let records: Array<{ address: string; family: number }>;
  try {
    records = await resolver(h);
  } catch {
    throw new BlockedDestinationError('DNS resolution failed');
  }
  if (!records.length) throw new BlockedDestinationError('no DNS records');
  for (const r of records) {
    if (!isPublicAddress(r.address))
      throw new BlockedDestinationError('resolves to a non-public address');
  }
  const first = records[0];
  return { hostname: h, address: first.address, family: first.family === 6 ? 6 : 4 };
}
