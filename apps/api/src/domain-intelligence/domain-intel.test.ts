import { describe, expect, it } from 'vitest';
import { fakeFetch, jsonResponse, rdapFixtures } from '../../test/fake-fetch';
import { domainAgeDays } from './domain-intel.provider';
import { parseRdapDomain, RdapProvider } from './rdap.provider';
import { parseWhoisXml } from './whoisxml.provider';

const NOW = Date.parse('2026-10-28T00:00:00Z');

describe('domainAgeDays', () => {
  it('calculates whole days', () => {
    expect(domainAgeDays('2026-10-18T00:00:00Z', NOW)).toBe(10);
    expect(domainAgeDays('2026-10-27T23:00:00Z', NOW)).toBe(0);
  });
  it('returns undefined for missing, invalid or future dates', () => {
    expect(domainAgeDays(undefined, NOW)).toBeUndefined();
    expect(domainAgeDays('not a date', NOW)).toBeUndefined();
    expect(domainAgeDays('2027-05-01T00:00:00Z', NOW)).toBeUndefined();
  });
});

describe('RDAP parsing', () => {
  it('extracts dates, registrar, nameservers and redaction', () => {
    const d = parseRdapDomain(
      rdapFixtures.domain('2026-10-20T00:00:00Z'),
      'example-jobs.com',
      'example-jobs.com',
      NOW,
    );
    expect(d).toMatchObject({
      createdAt: '2026-10-20T00:00:00.000Z',
      expiresAt: '2027-01-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
      ageDays: 8,
      registrar: 'Test Registrar, Inc.',
      nameservers: ['ns1.test-dns.example', 'ns2.test-dns.example'],
      redacted: true,
    });
  });

  it('handles records without dates rather than inventing them', () => {
    const d = parseRdapDomain({ ldhName: 'x.com' }, 'x.com', 'x.com', NOW);
    expect(d.createdAt).toBeUndefined();
    expect(d.ageDays).toBeUndefined();
    expect(d.redacted).toBe(false);
  });
});

describe('RdapProvider', () => {
  const bootstrap = (u: string) =>
    u.includes('data.iana.org') ? jsonResponse(200, rdapFixtures.bootstrap) : undefined;

  it('looks up a domain via the IANA bootstrap', async () => {
    const f = fakeFetch(bootstrap, (u) =>
      u === 'https://rdap.test-registry.example/domain/example-jobs.com'
        ? jsonResponse(200, rdapFixtures.domain('2020-01-01T00:00:00Z'))
        : undefined,
    );
    const r = await new RdapProvider(f, 1000).lookup('example-jobs.com', 'example-jobs.com');
    expect(r.status).toBe('completed');
    expect(r.data?.registrar).toBe('Test Registrar, Inc.');
  });

  it('reports unavailable when the TLD has no RDAP service', async () => {
    const f = fakeFetch(bootstrap);
    const r = await new RdapProvider(f, 1000).lookup('example.co.ke', 'example.co.ke');
    expect(r.status).toBe('unavailable');
    expect(r.message).toMatch(/\.ke/);
    expect(r.data).toBeUndefined();
  });

  it('reports unavailable (not dangerous) for 404 and outages', async () => {
    const f404 = fakeFetch(bootstrap, () => jsonResponse(404, {}));
    expect(
      (await new RdapProvider(f404, 1000).lookup('example-jobs.com', 'example-jobs.com')).status,
    ).toBe('unavailable');
    const f500 = fakeFetch(bootstrap, () => jsonResponse(503, {}));
    expect(
      (await new RdapProvider(f500, 1000).lookup('example-jobs.com', 'example-jobs.com')).status,
    ).toBe('unavailable');
    const down = fakeFetch(() => {
      throw new Error('ENOTFOUND');
    });
    expect(
      (await new RdapProvider(down, 1000).lookup('example-jobs.com', 'example-jobs.com')).status,
    ).toBe('unavailable');
  });

  it('marks malformed RDAP as failed', async () => {
    const f = fakeFetch(bootstrap, () => jsonResponse(200, { events: 'nope' }));
    expect(
      (await new RdapProvider(f, 1000).lookup('example-jobs.com', 'example-jobs.com')).status,
    ).toBe('failed');
  });
});

describe('WhoisXML parsing', () => {
  it('parses a record and falls back to registry data', () => {
    const d = parseWhoisXml(
      {
        WhoisRecord: {
          registryData: {
            createdDate: '2026-10-01T00:00:00Z',
            registrarName: 'Registry Registrar',
          },
          nameServers: { hostNames: ['NS1.X.EXAMPLE'] },
        },
      },
      'x.com',
      'x.com',
      NOW,
    );
    expect(d).toMatchObject({
      ageDays: 27,
      registrar: 'Registry Registrar',
      nameservers: ['ns1.x.example'],
    });
  });
  it('returns null for missing WHOIS data and throws on API errors', () => {
    expect(
      parseWhoisXml({ WhoisRecord: { dataError: 'MISSING_WHOIS_DATA' } }, 'x.com', 'x.com'),
    ).toBeNull();
    expect(() =>
      parseWhoisXml({ ErrorMessage: { errorCode: 'AUTHENTICATE_03' } }, 'x.com', 'x.com'),
    ).toThrow();
  });
});
