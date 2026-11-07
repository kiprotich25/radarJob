/**
 * TEST DATA ONLY — fake HTTP layer for provider tests. No real API quota is used.
 */
import type { FetchLike, HttpResponse } from '../src/common/http';

export function jsonResponse(status: number, body: unknown): HttpResponse {
  return {
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

export function textResponse(status: number, body: string): HttpResponse {
  return {
    status,
    headers: new Headers(),
    json: async () => JSON.parse(body),
    text: async () => body,
  };
}

export type Route = (
  url: string,
  init?: RequestInit,
) => HttpResponse | Promise<HttpResponse> | undefined;

export interface FakeFetch extends FetchLike {
  calls: Array<{ url: string; init?: RequestInit }>;
}

export function fakeFetch(...routes: Route[]): FakeFetch {
  const calls: FakeFetch['calls'] = [];
  const fn = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    for (const r of routes) {
      const res = await r(url, init);
      if (res) return res;
    }
    throw new Error(`fake fetch: no route for ${url}`);
  }) as FakeFetch;
  fn.calls = calls;
  return fn;
}

/** SYNTHETIC VirusTotal payloads. */
export const vtFixtures = {
  urlObject: (
    stats: Record<string, number>,
    ageMs = 3600_000,
    results: Record<string, unknown> = {},
  ) => ({
    data: {
      type: 'url',
      attributes: {
        last_analysis_stats: {
          malicious: 0,
          suspicious: 0,
          harmless: 0,
          undetected: 0,
          timeout: 0,
          ...stats,
        },
        last_analysis_results: results,
        last_analysis_date: Math.floor((Date.now() - ageMs) / 1000),
      },
    },
  }),
  submission: { data: { type: 'analysis', id: 'u-test-analysis-id' } },
  analysis: (status: string, stats?: Record<string, number>) => ({
    data: {
      attributes: {
        status,
        date: Math.floor(Date.now() / 1000),
        ...(stats
          ? {
              stats: {
                malicious: 0,
                suspicious: 0,
                harmless: 0,
                undetected: 0,
                timeout: 0,
                ...stats,
              },
            }
          : {}),
        results: {},
      },
    },
  }),
};

/** SYNTHETIC RDAP payloads. */
export const rdapFixtures = {
  bootstrap: {
    services: [
      [['com', 'net'], ['https://rdap.test-registry.example/']],
      [['org'], ['https://rdap.org-registry.example/rdap/']],
    ],
  },
  domain: (createdIso: string) => ({
    objectClassName: 'domain',
    ldhName: 'EXAMPLE-JOBS.COM',
    events: [
      { eventAction: 'registration', eventDate: createdIso },
      { eventAction: 'expiration', eventDate: '2027-01-01T00:00:00Z' },
      { eventAction: 'last changed', eventDate: '2026-10-01T00:00:00Z' },
      { eventAction: 'last update of RDAP database', eventDate: '2026-10-28T00:00:00Z' },
    ],
    entities: [
      {
        roles: ['registrar'],
        vcardArray: [
          'vcard',
          [
            ['version', {}, 'text', '4.0'],
            ['fn', {}, 'text', 'Test Registrar, Inc.'],
          ],
        ],
      },
      {
        roles: ['registrant'],
        vcardArray: ['vcard', [['fn', {}, 'text', 'REDACTED FOR PRIVACY']]],
      },
    ],
    nameservers: [{ ldhName: 'NS1.TEST-DNS.EXAMPLE' }, { ldhName: 'NS2.TEST-DNS.EXAMPLE' }],
    status: ['client transfer prohibited'],
  }),
};
