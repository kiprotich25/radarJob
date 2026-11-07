import 'reflect-metadata';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import type { AnalysisReport } from '@radarjob/shared';
import { createApp } from '../src/bootstrap';
import type { AppOverrides } from '../src/app.module';
import { loadEnv } from '../src/config/env';
import { fakeFetch, jsonResponse, rdapFixtures, vtFixtures, type Route } from './fake-fetch';

/**
 * Integration tests: real Nest app, real pipeline, fake external HTTP.
 * All provider payloads are SYNTHETIC test data; no real API quota is used.
 */

const SECRET_VT = 'vt-secret-for-tests-0000';
const SECRET_AI = 'ai-secret-for-tests-1111';

const baseEnv = {
  NODE_ENV: 'test',
  VIRUSTOTAL_API_KEY: SECRET_VT,
  VIRUSTOTAL_POLL_INTERVAL_MS: '500',
  VIRUSTOTAL_POLL_ATTEMPTS: '1',
  VIRUSTOTAL_REQUESTS_PER_MINUTE: '1000',
  VIRUSTOTAL_CACHE_TTL_MINUTES: '0',
  DOMAIN_INTELLIGENCE_PROVIDER: 'rdap',
  AI_PROVIDER: 'anthropic',
  ANTHROPIC_API_KEY: SECRET_AI,
  ANALYSIS_RATE_LIMIT_PER_HOUR: '50',
};

const rdapRoutes: Route[] = [
  (u) => (u.includes('data.iana.org') ? jsonResponse(200, rdapFixtures.bootstrap) : undefined),
  (u) =>
    u.startsWith('https://rdap.test-registry.example/domain/')
      ? jsonResponse(200, rdapFixtures.domain('2019-03-01T00:00:00Z'))
      : undefined,
];
const vtClean: Route = (u) =>
  u.includes('virustotal.com')
    ? jsonResponse(200, vtFixtures.urlObject({ harmless: 70, undetected: 20 }))
    : undefined;
const vtMalicious: Route = (u) =>
  u.includes('virustotal.com')
    ? jsonResponse(
        200,
        vtFixtures.urlObject({ malicious: 5, harmless: 60 }, 3600_000, {
          E: { engine_name: 'TestEngine', category: 'malicious', result: 'phishing' },
        }),
      )
    : undefined;
const vtDown: Route = (u) => (u.includes('virustotal.com') ? jsonResponse(503, {}) : undefined);
const aiReply =
  (text: string): Route =>
  (u) =>
    u.includes('api.anthropic.com')
      ? jsonResponse(200, { content: [{ type: 'text', text }] })
      : undefined;
const aiDown: Route = (u) => (u.includes('api.anthropic.com') ? jsonResponse(529, {}) : undefined);
const aiEmptyIndicators = aiReply('{"indicators":[]}');

let app: NestExpressApplication | undefined;

async function start(
  env: Record<string, string> = {},
  routes: Route[] = [],
  overrides: AppOverrides = {},
) {
  const f = fakeFetch(...routes);
  app = await createApp(loadEnv({ ...baseEnv, ...env } as NodeJS.ProcessEnv), {
    fetch: f,
    ...overrides,
  });
  await app.init();
  return { http: request(app.getHttpServer()), fetch: f };
}

async function analyze(http: ReturnType<typeof request>, body: object): Promise<AnalysisReport> {
  const created = await http.post('/api/analysis').send(body).expect(202);
  for (let i = 0; i < 100; i++) {
    const r = await http.get(`/api/analysis/${created.body.id}`).expect(200);
    if (r.body.status !== 'running') return r.body as AnalysisReport;
    await new Promise((res) => setTimeout(res, 50));
  }
  throw new Error('analysis did not finish');
}

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe('health and configuration', () => {
  it('reports integration status without exposing secrets', async () => {
    const { http } = await start();
    const r = await http.get('/api/health').expect(200);
    expect(r.body.integrations).toMatchObject({
      virustotal: 'configured',
      ai: 'configured',
      persistence: 'memory',
      pageInspection: 'disabled',
    });
    expect(JSON.stringify(r.body)).not.toContain(SECRET_VT);
    expect(JSON.stringify(r.body)).not.toContain(SECRET_AI);
    expect(r.headers['content-security-policy']).toContain("default-src 'none'");
    expect(r.headers['x-powered-by']).toBeUndefined();
  });

  it('refuses mock providers in production', () => {
    expect(() =>
      loadEnv({ NODE_ENV: 'production', DEV_MOCK_PROVIDERS: 'true' } as NodeJS.ProcessEnv),
    ).toThrow(/never be enabled in production/);
  });
});

describe('input validation', () => {
  it.each([
    ['', 'invalid_url.empty'],
    ['javascript:alert(1)', 'invalid_url.unsupported_protocol'],
    ['http://localhost:8080/admin', 'invalid_url.local_address'],
    ['http://169.254.169.254/latest/meta-data', 'invalid_url.local_address'],
    ['http://[::ffff:7f00:1]/', 'invalid_url.local_address'],
    ['not a url at all', 'invalid_url.malformed'],
  ])('rejects %j with %s', async (url, code) => {
    const { http, fetch } = await start({}, [vtClean, ...rdapRoutes, aiEmptyIndicators]);
    const r = await http.post('/api/analysis').send({ url }).expect(400);
    expect(r.body.error.code).toBe(code);
    expect(fetch.calls).toHaveLength(0);
  });

  it('rejects unknown fields, wrong types and oversized bodies with the standard error shape', async () => {
    const { http } = await start();
    expect(
      (
        await http
          .post('/api/analysis')
          .send({ url: 'https://a.example.com', admin: true })
          .expect(400)
      ).body.error.code,
    ).toBe('invalid_request');
    expect((await http.post('/api/analysis').send({ url: 42 }).expect(400)).body.error.code).toBe(
      'invalid_request',
    );
    expect(
      (
        await http
          .post('/api/analysis')
          .send({ url: 'https://a.example.com', jobAdText: 'x'.repeat(40_000) })
          .expect(413)
      ).body.error.code,
    ).toBe('payload_too_large');
  });

  it('returns 404 for unknown or malformed report ids', async () => {
    const { http } = await start();
    await http.get('/api/analysis/not-a-uuid').expect(404);
    const r = await http.get('/api/analysis/00000000-0000-4000-8000-000000000000').expect(404);
    expect(r.body.error.code).toBe('not_found');
  });
});

describe('analysis pipeline', () => {
  it('produces a completed report from real-shaped provider data (zero detections, no URL issues)', async () => {
    const { http } = await start({}, [vtClean, ...rdapRoutes, aiEmptyIndicators]);
    const report = await analyze(http, {
      url: 'https://careers.acme-logistics.com/jobs/42?ref=whatsapp&token=SECRET123',
    });
    expect(report.status).toBe('completed');
    expect(report.checks.virustotal.stats?.malicious).toBe(0);
    expect(report.checks.domain.data?.registrar).toBe('Test Registrar, Inc.');
    expect(report.assessment?.category).toBe('no_significant_threats');
    expect(report.unknowns.join(' ')).toMatch(/webpage itself was not inspected/);
    // Query strings never appear in the report.
    expect(JSON.stringify(report)).not.toContain('SECRET123');
    expect(report.input.displayUrl).toBe('https://careers.acme-logistics.com/jobs/42');
    expect(report.input.hadQuery).toBe(true);
    expect(report.simulated).toBe(false);
  });

  it('flags a suspicious link despite zero VirusTotal detections (Scenario A)', async () => {
    const { http } = await start({}, [vtClean, ...rdapRoutes, aiEmptyIndicators]);
    const report = await analyze(http, { url: 'https://safaricom.jobs-portal-ke.com/apply' });
    expect(report.checks.virustotal.stats?.malicious).toBe(0);
    expect(report.assessment?.category).toBe('suspicious');
    expect(report.assessment?.conflicts.join(' ')).toMatch(/no detections yet/);
  });

  it('reports strong detections as potentially malicious (Scenario B)', async () => {
    const { http } = await start({}, [vtMalicious, ...rdapRoutes, aiEmptyIndicators]);
    const report = await analyze(http, { url: 'https://acme-logistics.com/jobs' });
    expect(report.assessment?.category).toBe('potentially_malicious');
    expect(report.checks.virustotal.flaggedBy?.[0].engine).toBe('TestEngine');
  });

  it('never reports zero threats when VirusTotal is down (Scenario D) and falls back to the template when AI fails', async () => {
    const { http } = await start({}, [vtDown, ...rdapRoutes, aiDown]);
    const report = await analyze(http, { url: 'https://acme-logistics.com/jobs' });
    expect(report.checks.virustotal.status).toBe('unavailable');
    expect(report.checks.virustotal.stats).toBeUndefined();
    expect(report.checks.domain.status).toBe('completed');
    expect(report.assessment?.category).toBe('inconclusive');
    expect(report.findings.join(' ')).not.toMatch(/VirusTotal:/);
    expect(report.explanation?.source).toBe('template');
    expect(report.checks.urlAi.status).toBe('unavailable');
  });

  it('separates the platform from a scam message (Scenario E)', async () => {
    const { http } = await start({}, [vtClean, ...rdapRoutes, aiEmptyIndicators]);
    const report = await analyze(http, {
      url: 'https://www.linkedin.com/jobs/view/123',
      jobAdText:
        'You have been selected. Pay KES 2,000 processing fee to our agent on 0712 345 678 to confirm your slot.',
    });
    expect(report.assessment?.link).toBe('no_significant_threats');
    expect(report.assessment?.offer).toBe('potentially_malicious');
    expect(JSON.stringify(report)).not.toContain('345 678');
  });

  it('uses validated AI explanations and discards malformed AI output', async () => {
    const good = JSON.stringify({
      summary:
        'The available checks did not find significant threats. This is not a guarantee that the job is real.',
      whyItMatters: ['Checks are limited.'],
      additionalActions: [],
    });
    let call = 0;
    const ai: Route = (u) => {
      if (!u.includes('api.anthropic.com')) return undefined;
      call++;
      return jsonResponse(200, {
        content: [{ type: 'text', text: call === 1 ? 'not json' : good }],
      });
    };
    const { http } = await start({}, [vtClean, ...rdapRoutes, ai]);
    const report = await analyze(http, { url: 'https://acme-logistics.com/jobs' });
    expect(report.checks.urlAi.status).toBe('failed');
    expect(report.explanation?.source).toBe('ai');
    expect(report.explanation?.summary).toMatch(/not a guarantee/);
  });

  it('never sends secrets to the browser or the AI provider', async () => {
    const { http, fetch } = await start({}, [vtClean, ...rdapRoutes, aiEmptyIndicators]);
    const report = await analyze(http, { url: 'https://acme-logistics.com/jobs' });
    expect(JSON.stringify(report)).not.toContain(SECRET_VT);
    expect(JSON.stringify(report)).not.toContain(SECRET_AI);
    const aiBodies = fetch.calls
      .filter((c) => c.url.includes('anthropic'))
      .map((c) => String(c.init?.body));
    expect(aiBodies.join('')).not.toContain(SECRET_VT);
  });

  it('marks reports as simulated when development mock providers are on', async () => {
    const { http } = await start({
      VIRUSTOTAL_API_KEY: '',
      AI_PROVIDER: 'none',
      DEV_MOCK_PROVIDERS: 'true',
      NODE_ENV: 'development',
    });
    const report = await analyze(http, { url: 'https://mock-malicious.example.com/' });
    expect(report.simulated).toBe(true);
    expect(report.assessment?.category).toBe('potentially_malicious');
  });

  it('reports not_configured integrations honestly', async () => {
    const { http } = await start({
      VIRUSTOTAL_API_KEY: '',
      AI_PROVIDER: 'none',
      DOMAIN_INTELLIGENCE_PROVIDER: 'none',
    });
    const report = await analyze(http, { url: 'https://acme-logistics.com/jobs' });
    expect(report.checks.virustotal.status).toBe('not_configured');
    expect(report.checks.domain.status).toBe('not_configured');
    expect(report.assessment?.category).toBe('inconclusive');
  });
});

describe('abuse protection', () => {
  it('rate-limits analysis requests per client', async () => {
    const { http } = await start({ ANALYSIS_RATE_LIMIT_PER_HOUR: '2' }, [
      vtClean,
      ...rdapRoutes,
      aiEmptyIndicators,
    ]);
    await http.post('/api/analysis').send({ url: 'https://a.example.com' }).expect(202);
    await http.post('/api/analysis').send({ url: 'https://b.example.com' }).expect(202);
    const r = await http.post('/api/analysis').send({ url: 'https://c.example.com' }).expect(429);
    expect(r.body.error.code).toBe('rate_limited');
    // Education content stays available.
    await http.get('/api/education/guides').expect(200);
  });
});

describe('job advert endpoint', () => {
  it('returns red flags with quoted evidence', async () => {
    const { http } = await start({ AI_PROVIDER: 'none' });
    const r = await http
      .post('/api/job-ad-analysis')
      .send({
        text: 'URGENT hiring! Pay KES 1,000 interview booking fee to till 512345. Do not tell anyone.',
      })
      .expect(200);
    expect(r.body.category).toBe('potentially_malicious');
    expect(r.body.indicators.map((i: { category: string }) => i.category)).toEqual(
      expect.arrayContaining(['upfront_fee', 'urgency', 'secrecy']),
    );
    expect(r.body.aiStatus).toBe('not_configured');
  });

  it('rejects very short text', async () => {
    const { http } = await start({ AI_PROVIDER: 'none' });
    expect(
      (await http.post('/api/job-ad-analysis').send({ text: 'hi' }).expect(400)).body.error.code,
    ).toBe('text_too_short');
  });
});

describe('education endpoints', () => {
  it('work without any credentials', async () => {
    const { http } = await start({
      VIRUSTOTAL_API_KEY: '',
      AI_PROVIDER: 'none',
      DOMAIN_INTELLIGENCE_PROVIDER: 'none',
    });
    const list = await http.get('/api/education/guides').expect(200);
    expect(list.body.guides).toHaveLength(10);
    const search = await http.get('/api/education/guides?q=whatsapp').expect(200);
    expect(search.body.guides[0].slug).toBe('whatsapp-telegram-recruitment-scams');
    await http.get('/api/education/guides/money-mule-recruitment').expect(200);
    await http.get('/api/education/guides/nope').expect(404);
    const quiz = await http.get('/api/education/quiz').expect(200);
    expect(quiz.body.questions.length).toBeGreaterThanOrEqual(10);
  });
});
