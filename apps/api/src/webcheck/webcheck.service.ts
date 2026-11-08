import { Logger } from '@nestjs/common';
import type { WebCheckCheck, WebCheckThreatSource } from '@radarjob/shared';
import { fetchWithTimeout, readJson, type FetchLike } from '../common/http';
import { isProviderError, ProviderError } from '../common/provider-error';
import { InFlight, TtlCache } from '../common/ttl-cache';
import type { IntegrationMode } from '../virustotal/reputation.provider';

/**
 * Web-Check (https://github.com/Lissy93/web-check) integration.
 *
 * Four independent lookups run in parallel against `{baseUrl}/api/<check>?url=…`:
 *   threats      Google Safe Browsing, PhishTank, URLhaus, NetAPI, Cloudmersive
 *   block-lists  whether public filtering DNS resolvers refuse to resolve the domain
 *   ssl          the site's TLS certificate and whether it validates
 *   rank         Tranco top-1M popularity rank
 *
 * Only scheme, host and path are sent (never the query string). Each part can
 * fail on its own; a failed part is reported as missing, never as clean.
 * Implementations must never throw.
 */
export interface WebCheckProvider {
  readonly mode: IntegrationMode;
  readonly enabled: boolean;
  check(normalizedUrl: string): Promise<WebCheckCheck>;
}

export const WEBCHECK_PROVIDER = Symbol('WEBCHECK_PROVIDER');

const NAME = 'Web-Check';

export class DisabledWebCheckProvider implements WebCheckProvider {
  readonly mode = 'not_configured' as const;
  readonly enabled = false;
  async check(): Promise<WebCheckCheck> {
    return { status: 'not_configured', message: 'Web-Check is not enabled on this server.' };
  }
}

/** Resolvers whose filtering is aimed at malware and phishing. Blocks here are security evidence. */
export const SECURITY_RESOLVERS = new Set(['Quad9', 'CleanBrowsing Security', 'Comodo Secure']);
/** Unfiltered resolvers. If one of these "blocks" the domain, the block-list result is unreliable. */
const UNFILTERED_RESOLVERS = new Set(['CloudFlare', 'Google DNS']);

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const truthy = (v: unknown) => v === true || v === 'true';
const falsy = (v: unknown) => v === false || v === 'false';
const clip = (s: string, n = 160) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

const unknownSource = (name: string): WebCheckThreatSource => ({ name, listed: null });

/** Parse the `threats` payload. Returns undefined when no source could be checked. Exported for tests. */
export function parseThreats(payload: unknown): WebCheckThreatSource[] | undefined {
  if (!isObj(payload) || payload.skipped || payload.error) return undefined;
  const out: WebCheckThreatSource[] = [];

  const sb = payload.safeBrowsing;
  if (isObj(sb) && typeof sb.unsafe === 'boolean') {
    const types = Array.isArray(sb.details)
      ? [
          ...new Set(
            sb.details
              .map((d) => (isObj(d) ? str(d.threatType) : undefined))
              .filter((t): t is string => Boolean(t))
              .map((t) => t.toLowerCase().replace(/_/g, ' ')),
          ),
        ]
      : [];
    out.push({
      name: 'Google Safe Browsing',
      listed: sb.unsafe,
      detail: sb.unsafe && types.length ? `Threat type: ${types.join(', ')}` : undefined,
    });
  } else out.push(unknownSource('Google Safe Browsing'));

  const pt = payload.phishTank;
  if (isObj(pt) && (truthy(pt.in_database) || falsy(pt.in_database))) {
    const listed = truthy(pt.in_database) && truthy(pt.valid);
    out.push({
      name: 'PhishTank',
      listed,
      detail: listed
        ? `Reported phishing site${truthy(pt.verified) ? ', verified by the community' : ''}`
        : undefined,
    });
  } else out.push(unknownSource('PhishTank'));

  const uh = payload.urlHaus;
  if (isObj(uh) && uh.query_status === 'ok') {
    const urls = Array.isArray(uh.urls) ? uh.urls.filter(isObj) : [];
    const online = urls.filter((u) => u.url_status === 'online').length;
    const count = Number(uh.url_count) || urls.length;
    out.push({
      name: 'URLhaus',
      listed: true,
      historical: urls.length > 0 && online === 0,
      detail: `${count} malware URL(s) recorded on this host${urls.length ? `, ${online} currently online` : ''}`,
    });
  } else if (isObj(uh) && uh.query_status === 'no_results') {
    out.push({ name: 'URLhaus', listed: false });
  } else out.push(unknownSource('URLhaus'));

  const na = payload.netApi;
  if (isObj(na) && typeof na.listed_now === 'boolean') {
    const listed = na.listed_now || truthy(na.listed_ever);
    const reason = str(na.block_reason);
    out.push({
      name: 'NetAPI compromised-sites feed',
      listed,
      historical: listed && !na.listed_now,
      detail: listed
        ? clip(
            [
              na.listed_now ? 'Currently listed' : 'Listed in the past',
              reason,
              str(na.last_seen) ? `last seen ${str(na.last_seen)!.slice(0, 10)}` : undefined,
            ]
              .filter(Boolean)
              .join(' — '),
          )
        : undefined,
    });
  } else out.push(unknownSource('NetAPI compromised-sites feed'));

  const cm = payload.cloudmersive;
  if (isObj(cm) && typeof cm.CleanResult === 'boolean') {
    const type = str(cm.WebsiteThreatType);
    out.push({
      name: 'Cloudmersive',
      listed: !cm.CleanResult,
      detail: !cm.CleanResult && type && type !== 'None' ? `Threat type: ${type}` : undefined,
    });
  }
  // Cloudmersive needs a key on the Web-Check server; omit it entirely when not configured.

  return out.some((s) => s.listed !== null) ? out : undefined;
}

/** Parse the `block-lists` payload. Exported for tests. */
export function parseBlocklists(payload: unknown): WebCheckCheck['blocklists'] {
  if (!isObj(payload) || !Array.isArray(payload.blocklists)) return undefined;
  const rows = payload.blocklists
    .filter(isObj)
    .map((r) => ({ server: str(r.server) ?? '', blocked: r.isBlocked === true }))
    .filter((r) => r.server);
  if (!rows.length) return undefined;
  // An unfiltered resolver refusing the domain means DNS itself is failing, not filtering.
  if (rows.some((r) => r.blocked && UNFILTERED_RESOLVERS.has(r.server))) return undefined;
  const security = rows.filter((r) => SECURITY_RESOLVERS.has(r.server));
  return {
    securityBlockedBy: security.filter((r) => r.blocked).map((r) => r.server),
    securityChecked: security.length,
    otherBlockedBy: rows
      .filter((r) => r.blocked && !SECURITY_RESOLVERS.has(r.server))
      .map((r) => r.server),
  };
}

const toIso = (v: unknown) => {
  const s = str(v);
  if (!s) return undefined;
  const t = Date.parse(s);
  return Number.isFinite(t) ? new Date(t).toISOString() : undefined;
};

/** Parse the `ssl` payload. Exported for tests. */
export function parseTls(payload: unknown): WebCheckCheck['tls'] {
  if (!isObj(payload) || payload.error || payload.skipped || typeof payload.isValid !== 'boolean')
    return undefined;
  const issuer = isObj(payload.issuer)
    ? (str(payload.issuer.O) ?? str(payload.issuer.CN))
    : undefined;
  return {
    valid: payload.isValid,
    error: str(payload.authError),
    issuer: issuer ? clip(issuer, 120) : undefined,
    validFrom: toIso(payload.valid_from),
    validTo: toIso(payload.valid_to),
  };
}

/** Parse the `rank` payload. Exported for tests. */
export function parseRank(payload: unknown): WebCheckCheck['rank'] {
  if (!isObj(payload) || payload.error) return undefined;
  if (typeof payload.skipped === 'string')
    return /isn't ranked|not ranked/i.test(payload.skipped) ? {} : undefined;
  if (!Array.isArray(payload.ranks)) return undefined;
  const ranks = payload.ranks
    .map((r) => (isObj(r) ? Number(r.rank) : NaN))
    .filter((n) => Number.isInteger(n) && n > 0);
  return ranks.length ? { position: Math.min(...ranks) } : {};
}

const PART_LABELS = {
  threats: 'threat feeds',
  'block-lists': 'DNS block lists',
  ssl: 'HTTPS certificate',
  rank: 'popularity rank',
} as const;
type Part = keyof typeof PART_LABELS;

export interface WebCheckOptions {
  baseUrl: string;
  timeoutMs: number;
  cacheTtlMs: number;
  fetchImpl: FetchLike;
}

export class WebCheckService implements WebCheckProvider {
  readonly mode = 'configured' as const;
  readonly enabled = true;
  readonly providerName: string;
  private readonly logger = new Logger('WebCheck');
  private readonly cache: TtlCache<WebCheckCheck>;
  private readonly inflight = new InFlight<WebCheckCheck>();

  constructor(private readonly opts: WebCheckOptions) {
    this.cache = new TtlCache(opts.cacheTtlMs, 1000);
    this.providerName =
      new URL(opts.baseUrl).hostname === 'web-check.xyz'
        ? 'Web-Check (public instance)'
        : 'Web-Check';
  }

  async check(normalizedUrl: string): Promise<WebCheckCheck> {
    let target: URL;
    try {
      target = new URL(normalizedUrl);
    } catch {
      return { status: 'failed', provider: this.providerName, message: 'Invalid link.' };
    }
    const origin = `${target.protocol}//${target.host}`;
    const withPath = `${origin}${target.pathname}`;
    const cached = this.cache.get(withPath);
    if (cached) return cached;
    return this.inflight.run(withPath, async () => {
      const result = await this.run(origin, withPath, target.hostname);
      if (result.status === 'completed') this.cache.set(withPath, result);
      return result;
    });
  }

  private async run(origin: string, withPath: string, host: string): Promise<WebCheckCheck> {
    const parts: Array<[Part, string]> = [
      ['threats', withPath],
      ['block-lists', origin],
      ['ssl', `https://${host}`],
      ['rank', origin],
    ];
    const settled = await Promise.allSettled(parts.map(([p, u]) => this.call(p, u)));
    const payload = (i: number) => {
      const s = settled[i]!;
      return s.status === 'fulfilled' ? s.value : undefined;
    };

    const result: WebCheckCheck = {
      status: 'completed',
      provider: this.providerName,
      threats: parseThreats(payload(0)),
      blocklists: parseBlocklists(payload(1)),
      tls: parseTls(payload(2)),
      rank: parseRank(payload(3)),
    };
    const got: Record<Part, boolean> = {
      threats: Boolean(result.threats),
      'block-lists': Boolean(result.blocklists),
      ssl: Boolean(result.tls),
      rank: Boolean(result.rank),
    };
    const missing = parts.map(([p]) => p).filter((p) => !got[p]);
    const rateLimited = settled.some(
      (s) =>
        s.status === 'rejected' && isProviderError(s.reason) && s.reason.kind === 'rate_limited',
    );
    for (const [i, s] of settled.entries()) {
      if (s.status === 'rejected')
        this.logger.warn(
          `${parts[i]![0]} failed for ${host}: ${s.reason instanceof Error ? s.reason.message : String(s.reason)}`,
        );
    }

    if (missing.length === parts.length) {
      return {
        status: 'unavailable',
        provider: this.providerName,
        message: rateLimited
          ? 'Web-Check is limiting requests right now, so threat-feed and DNS block-list checks did not run.'
          : 'Web-Check could not be reached, so threat-feed and DNS block-list checks did not run.',
      };
    }
    if (missing.length) {
      result.message = `Some Web-Check lookups were unavailable: ${missing.map((p) => PART_LABELS[p]).join(', ')}.`;
    }
    return result;
  }

  private async call(part: Part, target: string): Promise<unknown> {
    const url = `${this.opts.baseUrl}/api/${part}?url=${encodeURIComponent(target)}`;
    const res = await fetchWithTimeout(
      this.opts.fetchImpl,
      url,
      { headers: { accept: 'application/json' } },
      this.opts.timeoutMs,
      NAME,
    );
    if (res.status === 429)
      throw new ProviderError(
        'rate_limited',
        'Web-Check is limiting requests.',
        `${part} HTTP 429`,
      );
    if (res.status !== 200)
      throw new ProviderError(
        'unavailable',
        'Web-Check is unavailable.',
        `${part} HTTP ${res.status}`,
      );
    return readJson(res, NAME);
  }
}
