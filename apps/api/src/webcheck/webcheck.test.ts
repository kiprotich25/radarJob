import { describe, expect, it } from 'vitest';
import type { WebCheckCheck } from '@radarjob/shared';
import { fakeFetch, jsonResponse } from '../../test/fake-fetch';
import { webCheckIndicators } from '../risk-assessment/evidence';
import { assessRisk } from '../risk-assessment/risk-engine';
import { DEFAULT_RULES } from '../risk-assessment/rules.config';
import {
  parseBlocklists,
  parseRank,
  parseThreats,
  parseTls,
  WebCheckService,
} from './webcheck.service';

/** SYNTHETIC Web-Check payloads, shaped like the real API responses. */
const fx = {
  cleanThreats: {
    safeBrowsing: { unsafe: false },
    urlHaus: { query_status: 'no_results' },
    phishTank: { url: 'x', in_database: 'false' },
    cloudmersive: { skipped: 'Cloudmersive requires CLOUDMERSIVE_API_KEY to be set' },
    netApi: { listed_now: false, listed_ever: false },
  },
  badThreats: {
    safeBrowsing: { unsafe: true, details: [{ threatType: 'SOCIAL_ENGINEERING' }] },
    urlHaus: { error: 'URLhaus blocked (HTTP 401)' },
    phishTank: { in_database: 'true', valid: 'true', verified: 'true' },
    cloudmersive: { skipped: 'no key' },
    netApi: { listed_now: false, listed_ever: false },
  },
  blocklists: (blocked: string[]) => ({
    blocklists: [
      'AdGuard',
      'CleanBrowsing Security',
      'CloudFlare',
      'Comodo Secure',
      'Google DNS',
      'Quad9',
    ].map((server) => ({ server, serverIp: '0.0.0.0', isBlocked: blocked.includes(server) })),
  }),
  ssl: {
    issuer: { C: 'US', O: "Let's Encrypt", CN: 'R11' },
    valid_from: 'Oct  1 00:00:00 2026 GMT',
    valid_to: 'Dec 30 00:00:00 2026 GMT',
    isValid: true,
    authError: null,
  },
  rank: {
    ranks: [
      { date: '2026-11-01', rank: 5400 },
      { date: '2026-11-02', rank: 5210 },
    ],
  },
};

describe('Web-Check parsers', () => {
  it('reads clean threat feeds and ignores sources that need keys', () => {
    const t = parseThreats(fx.cleanThreats)!;
    expect(t.map((s) => [s.name, s.listed])).toEqual([
      ['Google Safe Browsing', false],
      ['PhishTank', false],
      ['URLhaus', false],
      ['NetAPI compromised-sites feed', false],
    ]);
  });

  it('marks failed sources as unknown, not clean', () => {
    const t = parseThreats(fx.badThreats)!;
    expect(t.find((s) => s.name === 'Google Safe Browsing')).toMatchObject({
      listed: true,
      detail: 'Threat type: social engineering',
    });
    expect(t.find((s) => s.name === 'PhishTank')?.listed).toBe(true);
    expect(t.find((s) => s.name === 'URLhaus')?.listed).toBeNull();
  });

  it('returns undefined when no source could be checked', () => {
    expect(parseThreats({ skipped: 'No threat sources returned data' })).toBeUndefined();
    expect(
      parseThreats({ safeBrowsing: { skipped: 'x' }, urlHaus: { error: 'y' }, phishTank: {} }),
    ).toBeUndefined();
  });

  it('flags URLhaus hosts whose malware is offline as historical', () => {
    const t = parseThreats({
      urlHaus: {
        query_status: 'ok',
        url_count: '2',
        urls: [{ url_status: 'offline' }, { url_status: 'offline' }],
      },
    })!;
    expect(t.find((s) => s.name === 'URLhaus')).toMatchObject({ listed: true, historical: true });
  });

  it('separates security filters from other filters', () => {
    expect(parseBlocklists(fx.blocklists(['Quad9', 'AdGuard']))).toEqual({
      securityBlockedBy: ['Quad9'],
      securityChecked: 3,
      otherBlockedBy: ['AdGuard'],
    });
  });

  it('discards block lists when an unfiltered resolver also fails', () => {
    expect(parseBlocklists(fx.blocklists(['Quad9', 'Google DNS']))).toBeUndefined();
  });

  it('parses certificates and rank', () => {
    expect(parseTls(fx.ssl)).toMatchObject({
      valid: true,
      issuer: "Let's Encrypt",
      validTo: '2026-12-30T00:00:00.000Z',
    });
    expect(parseTls({ error: 'SSL connection failed' })).toBeUndefined();
    expect(parseRank(fx.rank)).toEqual({ position: 5210 });
    expect(
      parseRank({ skipped: "jobs.example isn't ranked in the top 1 million sites yet" }),
    ).toEqual({});
    expect(parseRank({ error: 'rate-limited' })).toBeUndefined();
  });
});

describe('WebCheckService', () => {
  const routes = (overrides: Partial<Record<string, unknown>> = {}) => {
    const bodies: Record<string, unknown> = {
      threats: fx.cleanThreats,
      'block-lists': fx.blocklists([]),
      ssl: fx.ssl,
      rank: fx.rank,
      ...overrides,
    };
    return fakeFetch((url) => {
      const m = /\/api\/([a-z-]+)\?url=/.exec(url);
      const body = m ? bodies[m[1]!] : undefined;
      if (body === undefined) return undefined;
      return typeof body === 'number'
        ? jsonResponse(body, { error: 'x' })
        : jsonResponse(200, body);
    });
  };
  const make = (f: ReturnType<typeof fakeFetch>) =>
    new WebCheckService({
      baseUrl: 'https://webcheck.test',
      timeoutMs: 1000,
      cacheTtlMs: 60_000,
      fetchImpl: f,
    });

  it('combines all four lookups and never sends the query string', async () => {
    const f = routes();
    const r = await make(f).check('https://jobs.example.com/apply?token=secret#x');
    expect(r.status).toBe('completed');
    expect(r.message).toBeUndefined();
    expect(r.rank?.position).toBe(5210);
    expect(f.calls).toHaveLength(4);
    for (const c of f.calls) expect(decodeURIComponent(c.url)).not.toContain('secret');
    expect(f.calls.map((c) => decodeURIComponent(c.url))).toContain(
      'https://webcheck.test/api/threats?url=https://jobs.example.com/apply',
    );
  });

  it('reports partial results with a message', async () => {
    const r = await make(routes({ ssl: 500, rank: 500 })).check('https://jobs.example.com/');
    expect(r.status).toBe('completed');
    expect(r.tls).toBeUndefined();
    expect(r.message).toMatch(/HTTPS certificate, popularity rank/);
  });

  it('is unavailable — not clean — when every lookup fails, and explains rate limiting', async () => {
    const r = await make(routes({ threats: 429, 'block-lists': 429, ssl: 429, rank: 429 })).check(
      'https://jobs.example.com/',
    );
    expect(r.status).toBe('unavailable');
    expect(r.message).toMatch(/limiting requests/);
  });

  it('caches completed results', async () => {
    const f = routes();
    const s = make(f);
    await s.check('https://jobs.example.com/a');
    await s.check('https://jobs.example.com/a?other=1');
    expect(f.calls).toHaveLength(4);
  });
});

describe('Web-Check evidence', () => {
  const base: WebCheckCheck = { status: 'completed' };

  it('treats a current threat-feed listing as strong evidence', () => {
    const ind = webCheckIndicators(
      { ...base, threats: parseThreats(fx.badThreats) },
      DEFAULT_RULES,
    );
    expect(ind).toHaveLength(1);
    expect(ind[0]).toMatchObject({ severity: 'strong', category: 'threat_feed_listed' });
    const a = assessRisk({
      vt: {
        status: 'completed',
        stats: { malicious: 0, suspicious: 0, harmless: 60, undetected: 20, timeout: 0 },
      },
      domain: { status: 'skipped' },
      indicators: ind,
      jobAdSupplied: false,
    });
    expect(a.category).toBe('potentially_malicious');
  });

  it('scales DNS-filter blocks by count and flags invalid certificates', () => {
    const one = webCheckIndicators(
      {
        ...base,
        blocklists: { securityBlockedBy: ['Quad9'], securityChecked: 3, otherBlockedBy: [] },
      },
      DEFAULT_RULES,
    );
    expect(one[0]?.severity).toBe('weak');
    const two = webCheckIndicators(
      {
        ...base,
        blocklists: {
          securityBlockedBy: ['Quad9', 'Comodo Secure'],
          securityChecked: 3,
          otherBlockedBy: [],
        },
        tls: { valid: false, error: 'CERT_HAS_EXPIRED' },
      },
      DEFAULT_RULES,
    );
    expect(two.map((i) => [i.category, i.severity])).toEqual([
      ['dns_security_block', 'moderate'],
      ['tls_invalid', 'moderate'],
    ]);
    expect(two[1]?.evidence).toMatch(/expired/);
  });

  it('produces nothing from clean, missing or failed results', () => {
    expect(
      webCheckIndicators(
        {
          ...base,
          threats: parseThreats(fx.cleanThreats),
          blocklists: parseBlocklists(fx.blocklists([])),
          tls: parseTls(fx.ssl),
        },
        DEFAULT_RULES,
      ),
    ).toEqual([]);
    expect(webCheckIndicators({ status: 'unavailable' }, DEFAULT_RULES)).toEqual([]);
    expect(webCheckIndicators(undefined, DEFAULT_RULES)).toEqual([]);
  });

  it('explains when a widely visited site is flagged', () => {
    const a = assessRisk({
      vt: {
        status: 'completed',
        stats: { malicious: 1, suspicious: 0, harmless: 60, undetected: 20, timeout: 0 },
      },
      domain: { status: 'skipped' },
      webCheck: { status: 'completed', rank: { position: 250 } },
      indicators: [
        {
          id: 'x',
          source: 'virustotal',
          dimension: 'link',
          category: 'reputation_malicious_few',
          title: 't',
          evidence: 'e',
          whyItMatters: 'w',
          basis: 'observed',
          severity: 'moderate',
        },
      ],
      jobAdSupplied: false,
    });
    expect(a.conflicts.join(' ')).toMatch(/most visited/);
  });
});
