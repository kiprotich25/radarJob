import { describe, expect, it } from 'vitest';
import type { DomainCheck, Indicator, VirusTotalCheck } from '@radarjob/shared';
import { validateAndNormalizeUrl } from '@radarjob/shared';
import { analyzeJobAdText } from '../job-ad/job-ad.rules';
import { analyzeUrlStructure } from '../url-analysis/url-heuristics';
import { domainIndicators, virusTotalIndicators } from './evidence';
import { assessRisk, mostSevere } from './risk-engine';
import { DEFAULT_RULES } from './rules.config';

/** SYNTHETIC scenarios from the product specification (§15). Not real scan results. */

const vtClean: VirusTotalCheck = {
  status: 'completed',
  origin: 'existing_report',
  stats: { malicious: 0, suspicious: 0, harmless: 70, undetected: 20, timeout: 0 },
};
const vtMalicious: VirusTotalCheck = {
  status: 'completed',
  stats: { malicious: 6, suspicious: 1, harmless: 60, undetected: 20, timeout: 0 },
  flaggedBy: [{ engine: 'TestEngine', category: 'malicious', result: 'phishing' }],
};
const vtDown: VirusTotalCheck = {
  status: 'unavailable',
  message: 'VirusTotal is temporarily unavailable.',
};
const domainOld: DomainCheck = {
  status: 'completed',
  data: {
    domain: 'x.com',
    unicodeDomain: 'x.com',
    ageDays: 3000,
    createdAt: '2018-01-01T00:00:00Z',
    nameservers: [],
    statuses: [],
    redacted: false,
  },
};
const domainNew: DomainCheck = {
  status: 'completed',
  data: {
    domain: 'x.com',
    unicodeDomain: 'x.com',
    ageDays: 4,
    createdAt: '2026-10-24T00:00:00Z',
    nameservers: [],
    statuses: [],
    redacted: true,
  },
};
const domainMissing: DomainCheck = { status: 'unavailable', message: 'no RDAP' };

function urlIndicators(raw: string): Indicator[] {
  const r = validateAndNormalizeUrl(raw);
  if (!r.ok) throw new Error('bad url');
  return analyzeUrlStructure(r.value).indicators;
}

function run(vt: VirusTotalCheck, domain: DomainCheck, url: string, jobAd?: string) {
  const indicators = [
    ...virusTotalIndicators(vt, DEFAULT_RULES),
    ...domainIndicators(domain, DEFAULT_RULES),
    ...urlIndicators(url),
    ...(jobAd ? analyzeJobAdText(jobAd) : []),
  ];
  return assessRisk({ vt, domain, indicators, jobAdSupplied: Boolean(jobAd) });
}

describe('risk engine — specification scenarios', () => {
  it('A: zero VirusTotal detections + impersonating URL → suspicious, not safe, with conflict explained', () => {
    const a = run(vtClean, domainOld, 'https://safaricom.careers-hiring.example.com/apply');
    expect(a.category).toBe('suspicious');
    expect(a.conflicts.join(' ')).toMatch(/no detections yet/);
  });

  it('B: several malicious detections → potentially malicious', () => {
    const a = run(vtMalicious, domainOld, 'https://acme-jobs.example.com/');
    expect(a.category).toBe('potentially_malicious');
    expect(a.reasons[0]).toMatch(/6 of 87 security vendors/);
  });

  it('B2: detections on a long-established domain explain the conflict', () => {
    const a = run(vtMalicious, domainOld, 'https://acme-jobs.example.com/');
    expect(a.conflicts.join(' ')).toMatch(/compromised or misclassified/);
  });

  it('C: new domain with nothing else → not malicious (no significant threats)', () => {
    const a = run(vtClean, domainNew, 'https://acme-jobs.example.com/');
    expect(a.category).toBe('no_significant_threats');
    expect(a.reasons.join(' ')).toMatch(/minor signals/);
  });

  it('D: VirusTotal unavailable → inconclusive, never treated as clean', () => {
    const a = run(vtDown, domainOld, 'https://acme-jobs.example.com/');
    expect(a.category).toBe('inconclusive');
    expect(a.reasons.join(' ')).toMatch(/did not complete/);
  });

  it('E: legitimate platform + fee request → offer flagged, link not called malicious', () => {
    const a = run(
      vtClean,
      domainOld,
      'https://www.linkedin.com/jobs/view/123',
      'You are selected! Pay KES 2,000 processing fee via M-PESA to confirm your slot.',
    );
    expect(a.link).toBe('no_significant_threats');
    expect(a.offer).toBe('potentially_malicious');
    expect(a.category).toBe('potentially_malicious');
    expect(a.conflicts.join(' ')).toMatch(/legitimate platforms/);
  });
});

describe('risk engine — rules', () => {
  it('missing WHOIS data does not raise the category', () => {
    expect(run(vtClean, domainMissing, 'https://acme-jobs.example.com/').category).toBe(
      'no_significant_threats',
    );
  });

  it('a single vendor detection is a warning, not proof', () => {
    const vt: VirusTotalCheck = {
      status: 'completed',
      stats: { malicious: 1, suspicious: 0, harmless: 70, undetected: 20, timeout: 0 },
    };
    expect(run(vt, domainOld, 'https://acme-jobs.example.com/').category).toBe('suspicious');
  });

  it('moderate evidence from two independent sources escalates to potentially malicious', () => {
    const vt: VirusTotalCheck = {
      status: 'completed',
      stats: { malicious: 1, suspicious: 0, harmless: 70, undetected: 20, timeout: 0 },
    };
    expect(run(vt, domainOld, 'https://safaricom-recruitment.com/').category).toBe(
      'potentially_malicious',
    );
  });

  it('AI indicators never count as an independent source for escalation', () => {
    const ai: Indicator = {
      id: 'x',
      source: 'url_ai',
      dimension: 'link',
      category: 'ai_thing',
      title: 'AI pattern',
      evidence: 'x',
      whyItMatters: 'x',
      basis: 'inferred',
      severity: 'moderate',
    };
    const indicators = [...urlIndicators('https://safaricom-recruitment.com/'), ai];
    const a = assessRisk({ vt: vtClean, domain: domainOld, indicators, jobAdSupplied: false });
    expect(a.category).toBe('suspicious');
  });

  it('three weak signals together warrant caution', () => {
    const a = run(vtClean, domainNew, 'http://acme-recruit-jobs-portal-now.xyz/');
    expect(a.category).toBe('suspicious');
  });

  it('an inconclusive link is not made "safe" by clean job text', () => {
    const a = run(
      vtDown,
      domainOld,
      'https://acme-jobs.example.com/',
      'We are hiring a driver in Nakuru. Apply through our office.',
    );
    expect(a.offer).toBe('no_significant_threats');
    expect(a.category).toBe('inconclusive');
  });

  it('orders categories by severity', () => {
    expect(mostSevere('inconclusive', 'no_significant_threats')).toBe('inconclusive');
    expect(mostSevere('suspicious', 'inconclusive')).toBe('suspicious');
    expect(mostSevere('potentially_malicious', 'suspicious')).toBe('potentially_malicious');
  });

  it('stamps the rules version', () => {
    expect(run(vtClean, domainOld, 'https://acme-jobs.example.com/').rulesVersion).toBe(
      DEFAULT_RULES.version,
    );
  });
});

describe('domain age', () => {
  it('only creates a weak new-domain indicator', () => {
    const i = domainIndicators(domainNew, DEFAULT_RULES);
    expect(i.find((x) => x.category === 'new_domain')?.severity).toBe('weak');
    expect(i.find((x) => x.category === 'registration_redacted')?.severity).toBe('info');
  });
});
