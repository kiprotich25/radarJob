import type { LookupFunction } from 'node:net';
import { Agent, request } from 'undici';
import {
  assertPortAllowed,
  BlockedDestinationError,
  resolveAndVet,
  type Resolver,
  type VettedDestination,
} from './ssrf-guard';

export interface SafeFetchOptions {
  timeoutMs: number;
  maxBytes: number;
  maxRedirects: number;
  resolver: Resolver;
  /**
   * TEST HOOK ONLY: redirect the already-vetted connection to a local test server.
   * Never set in application code (app.module.ts does not expose it).
   */
  connectOverride?: (dest: VettedDestination) => VettedDestination & { port?: number };
}

export interface SafeFetchResult {
  kind: 'html' | 'not_html' | 'http_error';
  finalUrl: URL;
  status: number;
  redirectCount: number;
  contentType: string;
  body?: string;
  truncated: boolean;
}

const USER_AGENT =
  'RadarJob-SafetyScanner/0.1 (+job-scam awareness; no JavaScript, no form submission)';

/**
 * Fetch a single untrusted web page safely:
 * - http/https on ports 80/443 only
 * - every hop (including redirects) is DNS-resolved and vetted; the vetted IP is pinned for the connection
 * - GET only, no cookies, no credentials, no JavaScript execution, no downloads
 * - strict total timeout and response-size cap; only HTML is read
 */
export async function safeFetch(
  startUrl: string,
  opts: SafeFetchOptions,
): Promise<SafeFetchResult> {
  const deadline = Date.now() + opts.timeoutMs;
  let current = new URL(startUrl);
  let redirects = 0;

  for (;;) {
    if (current.protocol !== 'http:' && current.protocol !== 'https:') {
      throw new BlockedDestinationError(`protocol ${current.protocol} not allowed`);
    }
    if (current.username || current.password) {
      current.username = '';
      current.password = '';
    }
    assertPortAllowed(current);
    let dest: VettedDestination & { port?: number } = await resolveAndVet(
      current.hostname,
      opts.resolver,
    );
    if (opts.connectOverride) dest = opts.connectOverride(dest);
    const requestUrl = new URL(current);
    if (dest.port) requestUrl.port = String(dest.port);

    const pinnedLookup: LookupFunction = (_hostname, options, callback) => {
      if (options && (options as { all?: boolean }).all) {
        (callback as unknown as (e: null, a: Array<{ address: string; family: number }>) => void)(
          null,
          [{ address: dest.address, family: dest.family }],
        );
      } else {
        callback(null, dest.address, dest.family);
      }
    };

    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new BlockedDestinationError('timeout');
    const dispatcher = new Agent({
      connect: { lookup: pinnedLookup, timeout: Math.min(remaining, 5000) },
      headersTimeout: remaining,
      bodyTimeout: remaining,
    });
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), remaining);
      let res;
      try {
        res = await request(requestUrl, {
          method: 'GET',
          dispatcher,
          signal: controller.signal,
          headers: {
            'user-agent': USER_AGENT,
            accept: 'text/html,application/xhtml+xml;q=0.9',
            'accept-language': 'en',
            host: current.host,
          },
        });
      } catch (e) {
        clearTimeout(timer);
        if (controller.signal.aborted) throw new BlockedDestinationError('timeout');
        throw e;
      }

      const status = res.statusCode;
      if (status >= 300 && status < 400 && res.headers.location) {
        await res.body.dump();
        clearTimeout(timer);
        if (redirects >= opts.maxRedirects) throw new BlockedDestinationError('too many redirects');
        const loc = Array.isArray(res.headers.location)
          ? res.headers.location[0]
          : res.headers.location;
        current = new URL(loc, current);
        redirects++;
        continue;
      }

      const ctHeader = res.headers['content-type'];
      const contentType = (Array.isArray(ctHeader) ? ctHeader[0] : (ctHeader ?? '')).toLowerCase();
      if (status >= 400) {
        await res.body.dump();
        clearTimeout(timer);
        return {
          kind: 'http_error',
          finalUrl: current,
          status,
          redirectCount: redirects,
          contentType,
          truncated: false,
        };
      }
      if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
        await res.body.dump();
        clearTimeout(timer);
        return {
          kind: 'not_html',
          finalUrl: current,
          status,
          redirectCount: redirects,
          contentType,
          truncated: false,
        };
      }

      const chunks: Buffer[] = [];
      let size = 0;
      let truncated = false;
      try {
        for await (const chunk of res.body) {
          const buf = chunk as Buffer;
          if (size + buf.length > opts.maxBytes) {
            chunks.push(buf.subarray(0, opts.maxBytes - size));
            truncated = true;
            break;
          }
          chunks.push(buf);
          size += buf.length;
        }
      } finally {
        clearTimeout(timer);
        if (truncated) res.body.destroy();
      }
      return {
        kind: 'html',
        finalUrl: current,
        status,
        redirectCount: redirects,
        contentType,
        body: Buffer.concat(chunks).toString('utf8'),
        truncated,
      };
    } finally {
      dispatcher.close().catch(() => undefined);
    }
  }
}
