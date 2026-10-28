import { describe, expect, it } from 'vitest';
import { validateAndNormalizeUrl } from '@radarjob/shared';
import { analyzeUrlStructure, editDistance, hasMixedScripts, skeleton } from './url-heuristics';

const analyze = (raw: string) => {
  const r = validateAndNormalizeUrl(raw);
  if (!r.ok) throw new Error(r.code);
  return analyzeUrlStructure(r.value);
};
const cats = (raw: string) => analyze(raw).indicators.map((i) => i.category);

describe('string helpers', () => {
  it('computes edit distance with transpositions', () => {
    expect(editDistance('safaricom', 'safaricom')).toBe(0);
    expect(editDistance('safaricon', 'safaricom')).toBe(1);
    expect(editDistance('sfaaricom', 'safaricom')).toBe(1);
  });
  it('maps confusable characters', () => {
    expect(skeleton('g00gle')).toBe('google');
    expect(skeleton('rnicrosoft')).toBe('microsoft');
  });
  it('detects mixed scripts', () => {
    expect(hasMixedScripts('safarіcom')).toBe(true); // Cyrillic і
    expect(hasMixedScripts('safaricom')).toBe(false);
  });
});

describe('analyzeUrlStructure', () => {
  it('finds nothing notable on official domains', () => {
    expect(cats('https://www.safaricom.co.ke/careers')).toEqual([]);
    expect(cats('https://www.linkedin.com/jobs/view/123')).toEqual([]);
    expect(cats('https://www.kra.go.ke/careers')).toEqual([]);
  });

  it('does not flag ordinary unfamiliar domains, long paths or ccTLDs', () => {
    expect(
      cats('https://acme-logistics.co.ke/vacancies/2026/driver-mombasa-branch-full-time'),
    ).toEqual([]);
  });

  it('flags a brand name in the subdomain of an unrelated domain', () => {
    const r = analyze('https://safaricom.careers-portal.example.com/apply');
    expect(r.indicators[0]).toMatchObject({ category: 'brand_in_subdomain', severity: 'moderate' });
    expect(r.impersonatedBrands).toContain('Safaricom');
  });

  it('flags a brand combined with other words in the registered domain', () => {
    expect(analyze('https://safaricom-recruitment.com/').indicators[0]).toMatchObject({
      category: 'brand_in_domain',
      severity: 'moderate',
    });
  });

  it('treats the same brand name on a different ending as a weak signal only', () => {
    expect(analyze('https://safaricom.net/').indicators[0]).toMatchObject({
      category: 'brand_in_domain',
      severity: 'weak',
    });
  });

  it('flags government names outside .go.ke', () => {
    expect(cats('https://kra-jobs.com/apply')).toContain('brand_in_domain');
  });

  it('does not match short tokens inside longer words', () => {
    expect(cats('https://akrapovic.com/')).toEqual([]);
  });

  it('detects typosquatting', () => {
    expect(cats('https://safaricon.co.ke/jobs')).toContain('typosquatting');
    expect(cats('https://linkedln.com/jobs')).toContain('typosquatting');
  });

  it('detects homograph look-alikes of a known brand as strong evidence', () => {
    const r = analyze('https://safarіcom.co.ke/'); // Cyrillic і
    expect(r.indicators.find((i) => i.category === 'homograph')?.severity).toBe('strong');
  });

  it('flags IP-address hosts and @-credential tricks', () => {
    expect(cats('http://203.0.113.50/jobs')).toContain('ip_address_host');
    expect(cats('https://www.safaricom.co.ke@evil-site.example.net/login')).toContain(
      'credentials_in_url',
    );
  });

  it('treats shorteners as information, not a threat', () => {
    const r = analyze('https://bit.ly/3abcDEF');
    expect(r.indicators).toHaveLength(1);
    expect(r.indicators[0]).toMatchObject({ category: 'url_shortener', severity: 'info' });
  });

  it('marks free hosting and abused TLDs as weak only', () => {
    expect(analyze('https://jobs-hiring.netlify.app/').indicators[0].severity).toBe('weak');
    expect(analyze('https://acme-recruit.xyz/').indicators[0]).toMatchObject({
      category: 'abused_tld',
      severity: 'weak',
    });
  });

  it('escalates login wording only when combined with impersonation', () => {
    expect(analyze('https://example-hr.com/login').indicators[0]).toMatchObject({
      category: 'credential_path',
      severity: 'info',
    });
    expect(cats('https://equitybank-careers.com/verify/account')).toContain(
      'credential_path_with_brand',
    );
  });
});
