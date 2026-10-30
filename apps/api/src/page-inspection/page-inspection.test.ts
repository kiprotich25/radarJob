import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { extractPageFacts, pageIndicators } from './page-analyzer';
import { SafePageInspector } from './page-inspection.service';
import { safeFetch, type SafeFetchOptions } from './safe-fetch';
import {
  BlockedDestinationError,
  isPublicAddress,
  resolveAndVet,
  type Resolver,
} from './ssrf-guard';

describe('isPublicAddress', () => {
  it.each([
    ['93.184.215.14', true],
    ['8.8.8.8', true],
    ['2606:4700:4700::1111', true],
    ['127.0.0.1', false],
    ['10.1.2.3', false],
    ['172.16.0.1', false],
    ['192.168.0.10', false],
    ['169.254.169.254', false],
    ['100.64.0.1', false],
    ['0.0.0.0', false],
    ['::1', false],
    ['fd00::1', false],
    ['fe80::1', false],
    ['::ffff:127.0.0.1', false],
    ['::ffff:169.254.169.254', false],
    ['224.0.0.1', false],
    ['not-an-ip', false],
  ])('%s → %s', (ip, expected) => {
    expect(isPublicAddress(ip)).toBe(expected);
  });
});

describe('resolveAndVet', () => {
  const resolver =
    (map: Record<string, string[]>): Resolver =>
    async (h) => {
      const a = map[h];
      if (!a) throw new Error('ENOTFOUND');
      return a.map((address) => ({ address, family: address.includes(':') ? 6 : 4 }));
    };

  it('blocks internal hostnames before resolving', async () => {
    await expect(resolveAndVet('localhost', resolver({}))).rejects.toBeInstanceOf(
      BlockedDestinationError,
    );
    await expect(resolveAndVet('metadata.google.internal', resolver({}))).rejects.toThrow(
      /internal/,
    );
  });

  it('blocks names that resolve to private addresses (DNS-based SSRF)', async () => {
    await expect(
      resolveAndVet('evil.example', resolver({ 'evil.example': ['127.0.0.1'] })),
    ).rejects.toThrow(/non-public/);
  });

  it('blocks when ANY record is private (mixed answers)', async () => {
    await expect(
      resolveAndVet('mixed.example', resolver({ 'mixed.example': ['93.184.215.14', '10.0.0.1'] })),
    ).rejects.toThrow(/non-public/);
  });

  it('returns the vetted public address', async () => {
    const d = await resolveAndVet('ok.example', resolver({ 'ok.example': ['93.184.215.14'] }));
    expect(d.address).toBe('93.184.215.14');
  });
});

describe('safeFetch against a local test server', () => {
  let server: Server;
  let port: number;
  const publicIp = '93.184.215.14';
  // TEST HOOK: the guard sees public DNS answers; the connection is then redirected to the local server.
  const resolver: Resolver = async (h) => {
    if (h === 'jobs.test-site.example' || h === 'other.test-site.example')
      return [{ address: publicIp, family: 4 }];
    if (h === 'internal.test-site.example') return [{ address: '10.0.0.7', family: 4 }];
    throw new Error('ENOTFOUND');
  };
  const opts = (): SafeFetchOptions => ({
    timeoutMs: 3000,
    maxBytes: 2000,
    maxRedirects: 3,
    resolver,
    connectOverride: (d) => ({ ...d, address: '127.0.0.1', family: 4, port }),
  });

  beforeAll(async () => {
    server = createServer((req, res) => {
      if (req.url === '/redirect-internal') {
        res.writeHead(302, { location: 'http://internal.test-site.example/admin' });
        return res.end();
      }
      if (req.url === '/redirect-metadata') {
        res.writeHead(301, { location: 'http://169.254.169.254/latest/meta-data/' });
        return res.end();
      }
      if (req.url === '/redirect-port') {
        res.writeHead(302, { location: 'http://other.test-site.example:8080/' });
        return res.end();
      }
      if (req.url === '/redirect-ok') {
        res.writeHead(302, { location: 'http://other.test-site.example/landing' });
        return res.end();
      }
      if (req.url === '/loop') {
        res.writeHead(302, { location: '/loop' });
        return res.end();
      }
      if (req.url === '/file') {
        res.writeHead(200, { 'content-type': 'application/octet-stream' });
        return res.end('binary');
      }
      if (req.url === '/big') {
        res.writeHead(200, { 'content-type': 'text/html' });
        return res.end(`<html><body>${'x'.repeat(10_000)}</body></html>`);
      }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(
        `<html><head><title>Safaricom Careers Portal</title><script>alert('never run')</script></head><body>
         <h1>Apply now</h1><p>Pay KES 1,000 registration fee to till 512345 to confirm.</p>
         <form action="https://collector.other-domain.example/steal"><input name="email"><input type="password" name="pw">
         <label for="c">One-time code</label><input id="c" name="code"></form></body></html>`,
      );
    }).listen(0, '127.0.0.1');
    await new Promise<void>((r) => server.once('listening', () => r()));
    port = (server.address() as AddressInfo).port;
  });
  afterAll(() => new Promise<void>((r) => server.close(() => r())));

  it('fetches HTML through the pinned, vetted connection', async () => {
    const r = await safeFetch('http://jobs.test-site.example/apply', opts());
    expect(r.kind).toBe('html');
    expect(r.body).toContain('Careers Portal');
  });

  it('blocks a redirect to a host that resolves internally (redirect-based SSRF)', async () => {
    await expect(
      safeFetch('http://jobs.test-site.example/redirect-internal', opts()),
    ).rejects.toThrow(/non-public/);
  });

  it('blocks a redirect to the cloud metadata address', async () => {
    await expect(
      safeFetch('http://jobs.test-site.example/redirect-metadata', opts()),
    ).rejects.toThrow(/non-public/);
  });

  it('blocks redirects to non-standard ports', async () => {
    await expect(safeFetch('http://jobs.test-site.example/redirect-port', opts())).rejects.toThrow(
      /port 8080/,
    );
  });

  it('follows safe redirects and limits redirect loops', async () => {
    const ok = await safeFetch('http://jobs.test-site.example/redirect-ok', opts());
    expect(ok.finalUrl.hostname).toBe('other.test-site.example');
    expect(ok.redirectCount).toBe(1);
    await expect(safeFetch('http://jobs.test-site.example/loop', opts())).rejects.toThrow(
      /too many redirects/,
    );
  });

  it('does not read non-HTML bodies and truncates large pages', async () => {
    expect((await safeFetch('http://jobs.test-site.example/file', opts())).kind).toBe('not_html');
    const big = await safeFetch('http://jobs.test-site.example/big', opts());
    expect(big.truncated).toBe(true);
    expect(big.body!.length).toBeLessThanOrEqual(2000);
  });

  it('refuses direct requests to private IPs and other protocols', async () => {
    await expect(
      safeFetch('http://127.0.0.1/', { ...opts(), connectOverride: undefined }),
    ).rejects.toThrow(/non-public/);
    await expect(safeFetch('ftp://jobs.test-site.example/', opts())).rejects.toThrow(/protocol/);
  });

  it('inspector turns blocked destinations into an honest "not inspected" status', async () => {
    const inspector = new SafePageInspector(opts());
    const r = await inspector.inspect('http://jobs.test-site.example/redirect-metadata', []);
    expect(r.check.status).toBe('skipped');
    expect(r.check.message).toMatch(/security reasons/);
  });

  it('inspector extracts phishing indicators without executing scripts', async () => {
    const r = await new SafePageInspector({ ...opts(), maxBytes: 100_000 }).inspect(
      'http://jobs.test-site.example/apply',
      [],
    );
    expect(r.check.status).toBe('completed');
    const c = r.indicators.map((i) => i.category);
    expect(c).toEqual(
      expect.arrayContaining([
        'page_brand_mismatch',
        'password_form',
        'secret_code_request',
        'payment_request',
        'external_form_target',
      ]),
    );
    expect(r.indicators.find((i) => i.category === 'password_form')?.severity).toBe('strong');
    expect(r.facts?.textExcerpt).not.toContain('never run');
  });
});

describe('page analyzer', () => {
  const mismatchesFor = (title: string, domain: string) =>
    pageIndicators(extractPageFacts(`<title>${title}</title>`, domain), domain, []).map(
      (i) => i.category,
    );

  it('flags a page claiming to be Kenyan government outside .go.ke', () => {
    expect(mismatchesFor('Republic of Kenya - Job Portal', 'jobs-portal.example')).toEqual([
      'page_government_mismatch',
    ]);
    expect(mismatchesFor('Republic of Kenya - Job Portal', 'labour.go.ke')).toEqual([]);
  });

  it('does not accept a domain that merely ends in the letters go.ke', () => {
    expect(mismatchesFor('eCitizen careers', 'fake-go.ke')).toEqual(['page_brand_mismatch']);
    expect(mismatchesFor('eCitizen careers', 'ecitizen.go.ke')).toEqual([]);
  });

  it('treats a password field on a non-impersonating site as weak', () => {
    const facts = extractPageFacts(
      '<title>Acme Applicant Portal</title><form><input type="password"></form>',
      'acme.example',
    );
    const ind = pageIndicators(facts, 'acme.example', []);
    expect(ind).toHaveLength(1);
    expect(ind[0].severity).toBe('weak');
  });
});
