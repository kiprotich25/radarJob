import { createHash } from 'node:crypto';
import { Logger } from '@nestjs/common';
import type { VirusTotalCheck } from '@radarjob/shared';
import { fetchWithTimeout, readJson, sleep as realSleep, type FetchLike } from '../common/http';
import { SlidingWindowLimiter } from '../common/limiters';
import { isProviderError, kindForStatus, ProviderError } from '../common/provider-error';
import { InFlight, TtlCache } from '../common/ttl-cache';
import type { ReputationProvider } from './reputation.provider';
import {
  normalizeAnalysis,
  normalizeUrlObject,
  parseSubmission,
  vtUrlId,
  type NormalizedUrlReport,
} from './virustotal.normalize';

export interface VirusTotalOptions {
  apiKey: string | undefined;
  requestsPerMinute: number;
  maxReportAgeDays: number;
  pollAttempts: number;
  pollIntervalMs: number;
  cacheTtlMs: number;
  timeoutMs: number;
  baseUrl?: string;
  fetchImpl: FetchLike;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

const NAME = 'VirusTotal';
/** Delay before the first poll; doubles per attempt, capped at `pollIntervalMs`. */
const FIRST_POLL_DELAY_MS = 5000;

/**
 * Real VirusTotal v3 integration.
 * 1. Look up an existing URL report (cheap, no new scan).
 * 2. If none or it is too old, submit the URL and poll the analysis a bounded number of times.
 * Rate limits, auth failures, timeouts and malformed payloads become explicit statuses —
 * never a fabricated "0 detections".
 */
export class VirusTotalService implements ReputationProvider {
  readonly mode;
  private readonly logger = new Logger('VirusTotal');
  private readonly limiter: SlidingWindowLimiter;
  private readonly cache: TtlCache<VirusTotalCheck>;
  private readonly inflight = new InFlight<VirusTotalCheck>();
  private readonly baseUrl: string;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly now: () => number;

  constructor(private readonly opts: VirusTotalOptions) {
    this.mode = opts.apiKey ? ('configured' as const) : ('not_configured' as const);
    this.now = opts.now ?? Date.now;
    this.limiter = new SlidingWindowLimiter(opts.requestsPerMinute, 60_000, this.now);
    this.cache = new TtlCache(opts.cacheTtlMs, 1000, this.now);
    this.baseUrl = opts.baseUrl ?? 'https://www.virustotal.com/api/v3';
    this.sleep = opts.sleep ?? realSleep;
  }

  async check(normalizedUrl: string): Promise<VirusTotalCheck> {
    if (!this.opts.apiKey) {
      return {
        status: 'not_configured',
        message: 'VirusTotal is not configured on this server, so URL reputation was not checked.',
      };
    }
    const key = createHash('sha256').update(normalizedUrl).digest('hex');
    const cached = this.cache.get(key);
    if (cached) return cached;
    return this.inflight.run(key, async () => {
      const result = await this.run(normalizedUrl);
      if (result.status === 'completed') this.cache.set(key, result);
      return result;
    });
  }

  private async run(url: string): Promise<VirusTotalCheck> {
    let existing: NormalizedUrlReport | null = null;
    try {
      existing = await this.lookup(url);
      if (existing && this.isFresh(existing)) return this.completed(existing, 'existing_report');

      let analysisId: string;
      try {
        analysisId = await this.submit(url);
      } catch (e) {
        if (existing && isProviderError(e) && e.kind === 'rate_limited') {
          return this.completed(
            existing,
            'existing_report',
            'A fresh scan could not be requested because the VirusTotal rate limit was reached; showing the most recent existing analysis.',
          );
        }
        throw e;
      }

      for (let attempt = 0; attempt < this.opts.pollAttempts; attempt++) {
        await this.sleep(Math.min(FIRST_POLL_DELAY_MS * 2 ** attempt, this.opts.pollIntervalMs));
        const analysis = await this.poll(analysisId);
        if (analysis.state === 'completed') return this.completed(analysis.report, 'new_scan');
      }
      if (existing) {
        return this.completed(
          existing,
          'existing_report',
          'The new VirusTotal scan had not finished in time; showing the most recent existing analysis.',
        );
      }
      return {
        status: 'pending',
        message:
          'VirusTotal accepted the link but had not finished analysing it within the time limit. No result is available yet — this is not a clean result.',
      };
    } catch (e) {
      return this.failure(e, existing);
    }
  }

  private isFresh(r: NormalizedUrlReport): boolean {
    if (!r.analysisDate) return false;
    const ageMs = this.now() - Date.parse(r.analysisDate);
    return ageMs <= this.opts.maxReportAgeDays * 86_400_000;
  }

  private completed(
    r: NormalizedUrlReport,
    origin: 'existing_report' | 'new_scan',
    message?: string,
  ): VirusTotalCheck {
    return {
      status: 'completed',
      stats: r.stats,
      analysisDate: r.analysisDate,
      origin,
      flaggedBy: r.flaggedBy,
      message,
    };
  }

  private failure(e: unknown, existing: NormalizedUrlReport | null): VirusTotalCheck {
    if (!isProviderError(e)) {
      this.logger.error(`unexpected error: ${e instanceof Error ? e.message : String(e)}`);
      return { status: 'failed', message: 'The VirusTotal check failed unexpectedly.' };
    }
    this.logger.warn(`${e.kind}: ${e.detail ?? ''}`);
    if (existing && e.kind !== 'auth') {
      return this.completed(
        existing,
        'existing_report',
        `${e.userMessage} Showing the most recent existing analysis instead.`,
      );
    }
    const status = e.kind === 'auth' || e.kind === 'bad_response' ? 'failed' : 'unavailable';
    return { status, message: e.userMessage };
  }

  private async slot(maxWaitMs: number) {
    const wait = this.limiter.waitTime();
    if (wait > maxWaitMs) {
      throw new ProviderError(
        'rate_limited',
        'The VirusTotal request limit has been reached. Try again in a few minutes.',
        'local limiter',
      );
    }
    if (wait > 0) await this.sleep(wait);
    if (!this.limiter.take()) {
      throw new ProviderError(
        'rate_limited',
        'The VirusTotal request limit has been reached. Try again in a few minutes.',
        'local limiter',
      );
    }
  }

  private async request(path: string, init: RequestInit = {}) {
    await this.slot(this.opts.pollIntervalMs * 2);
    const res = await fetchWithTimeout(
      this.opts.fetchImpl,
      `${this.baseUrl}${path}`,
      {
        ...init,
        headers: {
          accept: 'application/json',
          'x-apikey': this.opts.apiKey as string,
          ...(init.headers ?? {}),
        },
      },
      this.opts.timeoutMs,
      NAME,
    );
    return res;
  }

  private errorFor(status: number): ProviderError {
    const kind = kindForStatus(status);
    const messages: Record<string, string> = {
      auth: "VirusTotal rejected the server's credentials, so reputation could not be checked.",
      rate_limited: 'The VirusTotal request quota has been reached. Try again later.',
      unavailable: 'VirusTotal is temporarily unavailable.',
      bad_response: 'VirusTotal could not process this request.',
      not_found: 'VirusTotal has no record of this link.',
    };
    return new ProviderError(
      kind,
      messages[kind] ?? 'VirusTotal request failed.',
      `HTTP ${status}`,
    );
  }

  private async lookup(url: string): Promise<NormalizedUrlReport | null> {
    const res = await this.request(`/urls/${vtUrlId(url)}`);
    if (res.status === 404) return null;
    if (res.status !== 200) throw this.errorFor(res.status);
    return normalizeUrlObject(await readJson(res, NAME));
  }

  private async submit(url: string): Promise<string> {
    const res = await this.request('/urls', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ url }).toString(),
    });
    if (res.status !== 200) throw this.errorFor(res.status);
    return parseSubmission(await readJson(res, NAME));
  }

  private async poll(analysisId: string) {
    const res = await this.request(`/analyses/${encodeURIComponent(analysisId)}`);
    if (res.status !== 200) throw this.errorFor(res.status);
    return normalizeAnalysis(await readJson(res, NAME));
  }
}
