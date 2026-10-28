import { Logger } from '@nestjs/common';
import { z } from 'zod';
import type { DomainCheck, DomainData } from '@radarjob/shared';
import { fetchWithTimeout, readJson, type FetchLike } from '../common/http';
import { isProviderError, kindForStatus, ProviderError } from '../common/provider-error';
import { TtlCache } from '../common/ttl-cache';
import { domainAgeDays, toIsoDate, type DomainIntelProvider } from './domain-intel.provider';

/**
 * RDAP (Registration Data Access Protocol, RFC 9082/9083) — the IETF standard
 * successor to WHOIS, free and keyless. Servers are discovered via the IANA
 * bootstrap registry (RFC 9224). Some ccTLDs do not publish RDAP; those lookups
 * are reported as unavailable rather than guessed.
 */

const BOOTSTRAP_URL = 'https://data.iana.org/rdap/dns.json';
const NAME = 'Domain registration lookup (RDAP)';

const BootstrapSchema = z.object({
  services: z.array(z.tuple([z.array(z.string()), z.array(z.string())])),
});

const VcardSchema = z.tuple([z.literal('vcard'), z.array(z.array(z.unknown()))]).optional();

const EntitySchema: z.ZodType<RdapEntity> = z.lazy(() =>
  z.object({
    roles: z.array(z.string()).optional(),
    vcardArray: VcardSchema,
    entities: z.array(EntitySchema).optional(),
  }),
);
interface RdapEntity {
  roles?: string[];
  vcardArray?: ['vcard', unknown[][]];
  entities?: RdapEntity[];
}

const DomainSchema = z.object({
  ldhName: z.string().optional(),
  events: z
    .array(z.object({ eventAction: z.string(), eventDate: z.string().optional() }))
    .optional(),
  entities: z.array(EntitySchema).optional(),
  nameservers: z.array(z.object({ ldhName: z.string().optional() })).optional(),
  status: z.array(z.string()).optional(),
  redacted: z.array(z.unknown()).optional(),
  remarks: z
    .array(z.object({ title: z.string().optional(), description: z.array(z.string()).optional() }))
    .optional(),
});

function vcardFn(entity: RdapEntity): string | undefined {
  const props = entity.vcardArray?.[1];
  if (!props) return undefined;
  const fn = props.find((p) => Array.isArray(p) && p[0] === 'fn');
  const value = fn?.[3];
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 120) : undefined;
}

/** Parse an RDAP domain object into RadarJob's shape. Exported for tests. */
export function parseRdapDomain(
  payload: unknown,
  domain: string,
  unicodeDomain: string,
  now = Date.now(),
): DomainData {
  const r = DomainSchema.safeParse(payload);
  if (!r.success)
    throw new ProviderError(
      'bad_response',
      'The registration service returned an unexpected response.',
      'malformed RDAP',
    );
  const d = r.data;
  const event = (action: string) =>
    toIsoDate(d.events?.find((e) => e.eventAction.toLowerCase() === action)?.eventDate);
  const createdAt = event('registration');
  const registrarEntity = d.entities?.find((e) => e.roles?.includes('registrar'));
  const serialized = JSON.stringify(d.entities ?? []) + JSON.stringify(d.remarks ?? []);
  const redacted =
    Boolean(d.redacted?.length) || /redacted|privacy|data protected/i.test(serialized);
  return {
    domain,
    unicodeDomain,
    createdAt,
    updatedAt: event('last changed'),
    expiresAt: event('expiration'),
    ageDays: domainAgeDays(createdAt, now),
    registrar: registrarEntity ? vcardFn(registrarEntity) : undefined,
    nameservers: (d.nameservers ?? [])
      .map((n) => n.ldhName?.toLowerCase())
      .filter((n): n is string => Boolean(n))
      .slice(0, 8),
    statuses: (d.status ?? []).slice(0, 10),
    redacted,
  };
}

export class RdapProvider implements DomainIntelProvider {
  readonly mode = 'configured' as const;
  readonly providerName = 'RDAP (IANA bootstrap)';
  private readonly logger = new Logger('RDAP');
  private readonly bootstrapCache = new TtlCache<Array<[string[], string[]]>>(24 * 3600_000, 1);
  private readonly resultCache = new TtlCache<DomainCheck>(6 * 3600_000, 2000);

  constructor(
    private readonly fetchImpl: FetchLike,
    private readonly timeoutMs: number,
  ) {}

  async lookup(domain: string, unicodeDomain: string): Promise<DomainCheck> {
    const cached = this.resultCache.get(domain);
    if (cached) return cached;
    try {
      const base = await this.serverFor(domain);
      if (!base) {
        return {
          status: 'unavailable',
          provider: this.providerName,
          message: `The registry for ".${domain.split('.').pop()}" domains does not publish RDAP data, so registration details could not be retrieved.`,
        };
      }
      const url = `${base.replace(/\/+$/, '')}/domain/${encodeURIComponent(domain)}`;
      const res = await fetchWithTimeout(
        this.fetchImpl,
        url,
        { headers: { accept: 'application/rdap+json, application/json' } },
        this.timeoutMs,
        NAME,
      );
      if (res.status === 404) {
        return {
          status: 'unavailable',
          provider: this.providerName,
          message: 'The registry returned no registration record for this domain.',
        };
      }
      if (res.status !== 200) {
        throw new ProviderError(
          kindForStatus(res.status),
          'The domain registration service is unavailable right now.',
          `HTTP ${res.status}`,
        );
      }
      const data = parseRdapDomain(await readJson(res, NAME), domain, unicodeDomain);
      const result: DomainCheck = { status: 'completed', provider: this.providerName, data };
      this.resultCache.set(domain, result);
      return result;
    } catch (e) {
      const msg = isProviderError(e) ? e.userMessage : 'The domain registration lookup failed.';
      this.logger.warn(
        `lookup failed for ${domain}: ${e instanceof Error ? e.message : String(e)}`,
      );
      return {
        status: isProviderError(e) && e.kind === 'bad_response' ? 'failed' : 'unavailable',
        provider: this.providerName,
        message: msg,
      };
    }
  }

  private async serverFor(domain: string): Promise<string | undefined> {
    let services = this.bootstrapCache.get('dns');
    if (!services) {
      const res = await fetchWithTimeout(
        this.fetchImpl,
        BOOTSTRAP_URL,
        { headers: { accept: 'application/json' } },
        this.timeoutMs,
        NAME,
      );
      if (res.status !== 200)
        throw new ProviderError(
          'unavailable',
          'The domain registration directory is unavailable.',
          `bootstrap HTTP ${res.status}`,
        );
      const parsed = BootstrapSchema.safeParse(await readJson(res, NAME));
      if (!parsed.success)
        throw new ProviderError(
          'bad_response',
          'The domain registration directory returned unexpected data.',
          'malformed bootstrap',
        );
      services = parsed.data.services;
      this.bootstrapCache.set('dns', services);
    }
    const labels = domain.toLowerCase().split('.');
    // Longest matching suffix wins (RFC 9224 §4).
    for (let i = 1; i < labels.length; i++) {
      const suffix = labels.slice(i).join('.');
      const entry = services.find(([tlds]) => tlds.includes(suffix));
      const https = entry?.[1].find((u) => u.startsWith('https://'));
      if (https) return https;
    }
    return undefined;
  }
}
