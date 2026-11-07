import { Logger } from '@nestjs/common';
import { z } from 'zod';
import type { DomainCheck, DomainData } from '@radarjob/shared';
import { fetchWithTimeout, readJson, type FetchLike } from '../common/http';
import { isProviderError, kindForStatus, ProviderError } from '../common/provider-error';
import { TtlCache } from '../common/ttl-cache';
import { domainAgeDays, toIsoDate, type DomainIntelProvider } from './domain-intel.provider';

/**
 * WhoisXML API "WHOIS API" provider (paid, broader ccTLD coverage than RDAP).
 * Docs: https://whois.whoisxmlapi.com/documentation/making-requests
 */
const NAME = 'WhoisXML API';

const RecordPart = z
  .object({
    createdDate: z.string().optional(),
    updatedDate: z.string().optional(),
    expiresDate: z.string().optional(),
    registrarName: z.string().optional(),
    nameServers: z.object({ hostNames: z.array(z.string()).optional() }).optional(),
    status: z.string().optional(),
    dataError: z.string().optional(),
  })
  .passthrough();

const ResponseSchema = z.object({
  WhoisRecord: RecordPart.extend({ registryData: RecordPart.optional() }).optional(),
  ErrorMessage: z
    .object({ errorCode: z.string().optional(), msg: z.string().optional() })
    .optional(),
});

export function parseWhoisXml(
  payload: unknown,
  domain: string,
  unicodeDomain: string,
  now = Date.now(),
): DomainData | null {
  const r = ResponseSchema.safeParse(payload);
  if (!r.success)
    throw new ProviderError(
      'bad_response',
      `${NAME} returned an unexpected response.`,
      'malformed',
    );
  if (r.data.ErrorMessage) {
    throw new ProviderError(
      'bad_response',
      `${NAME} could not look up this domain.`,
      r.data.ErrorMessage.errorCode,
    );
  }
  const rec = r.data.WhoisRecord;
  if (!rec) return null;
  const reg = rec.registryData;
  const createdAt = toIsoDate(rec.createdDate) ?? toIsoDate(reg?.createdDate);
  if (rec.dataError === 'MISSING_WHOIS_DATA' && !createdAt) return null;
  const serialized = JSON.stringify(rec);
  return {
    domain,
    unicodeDomain,
    createdAt,
    updatedAt: toIsoDate(rec.updatedDate) ?? toIsoDate(reg?.updatedDate),
    expiresAt: toIsoDate(rec.expiresDate) ?? toIsoDate(reg?.expiresDate),
    ageDays: domainAgeDays(createdAt, now),
    registrar: (rec.registrarName ?? reg?.registrarName)?.slice(0, 120),
    nameservers: (rec.nameServers?.hostNames ?? reg?.nameServers?.hostNames ?? [])
      .map((n) => n.toLowerCase())
      .slice(0, 8),
    statuses: (rec.status ?? reg?.status ?? '').split(/\s+/).filter(Boolean).slice(0, 10),
    redacted: /redacted|privacy|withheld|data protected/i.test(serialized),
  };
}

export class WhoisXmlProvider implements DomainIntelProvider {
  readonly mode = 'configured' as const;
  readonly providerName = NAME;
  private readonly logger = new Logger('WhoisXML');
  private readonly cache = new TtlCache<DomainCheck>(6 * 3600_000, 2000);

  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: FetchLike,
    private readonly timeoutMs: number,
  ) {}

  async lookup(domain: string, unicodeDomain: string): Promise<DomainCheck> {
    const cached = this.cache.get(domain);
    if (cached) return cached;
    try {
      const qs = new URLSearchParams({
        apiKey: this.apiKey,
        domainName: domain,
        outputFormat: 'JSON',
      });
      const res = await fetchWithTimeout(
        this.fetchImpl,
        `https://www.whoisxmlapi.com/whoisserver/WhoisService?${qs.toString()}`,
        { headers: { accept: 'application/json' } },
        this.timeoutMs,
        NAME,
      );
      if (res.status !== 200) {
        throw new ProviderError(
          kindForStatus(res.status),
          `${NAME} is unavailable right now.`,
          `HTTP ${res.status}`,
        );
      }
      const data = parseWhoisXml(await readJson(res, NAME), domain, unicodeDomain);
      if (!data) {
        return {
          status: 'unavailable',
          provider: NAME,
          message: 'No registration record was available for this domain.',
        };
      }
      const result: DomainCheck = { status: 'completed', provider: NAME, data };
      this.cache.set(domain, result);
      return result;
    } catch (e) {
      // Never log the request URL: it contains the API key.
      this.logger.warn(`lookup failed for ${domain}: ${isProviderError(e) ? e.kind : 'error'}`);
      const msg = isProviderError(e) ? e.userMessage : 'The domain registration lookup failed.';
      const status =
        isProviderError(e) && (e.kind === 'auth' || e.kind === 'bad_response')
          ? 'failed'
          : 'unavailable';
      return { status, provider: NAME, message: msg };
    }
  }
}
