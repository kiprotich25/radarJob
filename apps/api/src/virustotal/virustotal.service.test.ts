import { describe, expect, it } from 'vitest';
import { fakeFetch, jsonResponse, textResponse, vtFixtures } from '../../test/fake-fetch';
import type { FetchLike } from '../common/http';
import { normalizeAnalysis, normalizeUrlObject, vtUrlId } from './virustotal.normalize';
import { VirusTotalService } from './virustotal.service';

const URL_UNDER_TEST = 'https://jobs.example-test.com/apply';

function svc(
  fetchImpl: FetchLike,
  overrides: Partial<ConstructorParameters<typeof VirusTotalService>[0]> = {},
) {
  return new VirusTotalService({
    apiKey: 'test-key-not-real',
    requestsPerMinute: 100,
    maxReportAgeDays: 7,
    pollAttempts: 2,
    pollIntervalMs: 1,
    cacheTtlMs: 60_000,
    timeoutMs: 1000,
    fetchImpl,
    sleep: async () => undefined,
    ...overrides,
  });
}

const isLookup = (u: string) => u.includes('/urls/');
const isSubmit = (u: string, init?: RequestInit) => u.endsWith('/urls') && init?.method === 'POST';
const isPoll = (u: string) => u.includes('/analyses/');

describe('VirusTotal normalisation', () => {
  it('computes the unpadded base64url identifier', () => {
    expect(vtUrlId('https://example.com/')).toBe('aHR0cHM6Ly9leGFtcGxlLmNvbS8');
  });

  it('normalises a URL object and lists flagged engines (malicious first)', () => {
    const r = normalizeUrlObject(
      vtFixtures.urlObject({ malicious: 2, suspicious: 1, harmless: 60 }, 0, {
        B: { engine_name: 'EngineB', category: 'suspicious', result: 'suspicious' },
        A: { engine_name: 'EngineA', category: 'malicious', result: 'phishing' },
        C: { engine_name: 'EngineC', category: 'harmless', result: 'clean' },
      }),
    );
    expect(r?.stats.malicious).toBe(2);
    expect(r?.flaggedBy.map((f) => f.engine)).toEqual(['EngineA', 'EngineB']);
  });

  it('returns null when a URL object has no analysis yet', () => {
    expect(normalizeUrlObject({ data: { attributes: {} } })).toBeNull();
  });

  it('rejects malformed payloads', () => {
    expect(() => normalizeUrlObject({ nope: true })).toThrow(/malformed/);
    expect(() => normalizeAnalysis({ data: { attributes: { status: 'completed' } } })).toThrow(
      /without stats/,
    );
  });
});

describe('VirusTotalService', () => {
  it('reports not_configured without a key and never calls the API', async () => {
    const f = fakeFetch();
    const r = await svc(f, { apiKey: undefined }).check(URL_UNDER_TEST);
    expect(r.status).toBe('not_configured');
    expect(r.stats).toBeUndefined();
    expect(f.calls).toHaveLength(0);
  });

  it('uses a fresh existing report without submitting a new scan', async () => {
    const f = fakeFetch((u) =>
      isLookup(u)
        ? jsonResponse(200, vtFixtures.urlObject({ harmless: 70, undetected: 20 }))
        : undefined,
    );
    const r = await svc(f).check(URL_UNDER_TEST);
    expect(r).toMatchObject({
      status: 'completed',
      origin: 'existing_report',
      stats: { malicious: 0, harmless: 70 },
    });
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0].init?.headers).toMatchObject({ 'x-apikey': 'test-key-not-real' });
  });

  it('submits and polls when there is no existing report (zero detections is reported accurately)', async () => {
    let polls = 0;
    const f = fakeFetch(
      (u) => (isLookup(u) ? jsonResponse(404, { error: { code: 'NotFoundError' } }) : undefined),
      (u, i) => (isSubmit(u, i) ? jsonResponse(200, vtFixtures.submission) : undefined),
      (u) => {
        if (!isPoll(u)) return undefined;
        polls++;
        return jsonResponse(
          200,
          polls < 2
            ? vtFixtures.analysis('queued')
            : vtFixtures.analysis('completed', { harmless: 50, undetected: 40 }),
        );
      },
    );
    const r = await svc(f).check(URL_UNDER_TEST);
    expect(r.status).toBe('completed');
    expect(r.origin).toBe('new_scan');
    expect(r.stats?.malicious).toBe(0);
    const submit = f.calls.find((c) => isSubmit(c.url, c.init));
    expect(String(submit?.init?.body)).toBe(`url=${encodeURIComponent(URL_UNDER_TEST)}`);
  });

  it('reports a pending analysis honestly instead of a clean result', async () => {
    const f = fakeFetch(
      (u) => (isLookup(u) ? jsonResponse(404, {}) : undefined),
      (u, i) => (isSubmit(u, i) ? jsonResponse(200, vtFixtures.submission) : undefined),
      (u) => (isPoll(u) ? jsonResponse(200, vtFixtures.analysis('in-progress')) : undefined),
    );
    const r = await svc(f).check(URL_UNDER_TEST);
    expect(r.status).toBe('pending');
    expect(r.stats).toBeUndefined();
    expect(r.message).toMatch(/not a clean result/);
  });

  it('falls back to a stale existing report when the new scan does not finish', async () => {
    const f = fakeFetch(
      (u) =>
        isLookup(u)
          ? jsonResponse(200, vtFixtures.urlObject({ malicious: 1, harmless: 60 }, 30 * 86_400_000))
          : undefined,
      (u, i) => (isSubmit(u, i) ? jsonResponse(200, vtFixtures.submission) : undefined),
      (u) => (isPoll(u) ? jsonResponse(200, vtFixtures.analysis('queued')) : undefined),
    );
    const r = await svc(f).check(URL_UNDER_TEST);
    expect(r.status).toBe('completed');
    expect(r.origin).toBe('existing_report');
    expect(r.message).toMatch(/had not finished/);
  });

  it.each([
    [401, 'failed'],
    [403, 'failed'],
    [429, 'unavailable'],
    [500, 'unavailable'],
    [503, 'unavailable'],
  ])('maps HTTP %i to %s with no fabricated statistics', async (status, expected) => {
    const f = fakeFetch(() => jsonResponse(status, { error: { code: 'X' } }));
    const r = await svc(f).check(URL_UNDER_TEST);
    expect(r.status).toBe(expected);
    expect(r.stats).toBeUndefined();
    expect(r.message).toBeTruthy();
    expect(JSON.stringify(r)).not.toContain('test-key-not-real');
  });

  it('treats a malformed response as failed', async () => {
    const f = fakeFetch(() => textResponse(200, '<html>not json</html>'));
    const r = await svc(f).check(URL_UNDER_TEST);
    expect(r.status).toBe('failed');
    expect(r.stats).toBeUndefined();
  });

  it('treats network errors and timeouts as unavailable', async () => {
    const r1 = await svc(async () => {
      throw new Error('ECONNRESET');
    }).check(URL_UNDER_TEST);
    expect(r1.status).toBe('unavailable');

    const slow: FetchLike = (_u, init) =>
      new Promise((_r, reject) =>
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted'))),
      );
    const r2 = await svc(slow, { timeoutMs: 20 }).check(URL_UNDER_TEST);
    expect(r2.status).toBe('unavailable');
    expect(r2.message).toMatch(/in time/);
  });

  it('enforces the outbound rate limit instead of exceeding quota', async () => {
    const f = fakeFetch(
      (u) => (isLookup(u) ? jsonResponse(404, {}) : undefined),
      (u, i) => (isSubmit(u, i) ? jsonResponse(200, vtFixtures.submission) : undefined),
    );
    const r = await svc(f, { requestsPerMinute: 1, pollIntervalMs: 10 }).check(URL_UNDER_TEST);
    expect(r.status).toBe('unavailable');
    expect(r.message).toMatch(/limit/);
    expect(f.calls).toHaveLength(1);
  });

  it('caches completed results and de-duplicates concurrent requests', async () => {
    const f = fakeFetch((u) =>
      isLookup(u) ? jsonResponse(200, vtFixtures.urlObject({ harmless: 70 })) : undefined,
    );
    const s = svc(f);
    await Promise.all([s.check(URL_UNDER_TEST), s.check(URL_UNDER_TEST)]);
    await s.check(URL_UNDER_TEST);
    expect(f.calls).toHaveLength(1);
  });
});
