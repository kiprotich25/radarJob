import type { AnalysisReport } from '@radarjob/shared';

/** SYNTHETIC test fixture — not a real scan result. */
export function fixtureReport(overrides: Partial<AnalysisReport> = {}): AnalysisReport {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    status: 'completed',
    createdAt: '2026-10-28T10:00:00.000Z',
    completedAt: '2026-10-28T10:00:20.000Z',
    simulated: false,
    input: {
      displayUrl: 'https://careers.example-test.com/jobs',
      hostname: 'careers.example-test.com',
      unicodeHostname: 'careers.example-test.com',
      registeredDomain: 'example-test.com',
      hadQuery: false,
      jobAdSupplied: false,
    },
    checks: {
      virustotal: {
        status: 'completed',
        stats: { malicious: 0, suspicious: 0, harmless: 70, undetected: 20, timeout: 0 },
      },
      domain: { status: 'unavailable', message: 'No RDAP.' },
      urlHeuristics: { status: 'completed' },
      urlAi: { status: 'not_configured' },
      page: { status: 'skipped', message: 'The webpage itself was not inspected.' },
      jobAd: { status: 'skipped' },
    },
    indicators: [],
    assessment: {
      category: 'no_significant_threats',
      link: 'no_significant_threats',
      offer: null,
      reasons: ['ok'],
      conflicts: [],
      rulesVersion: 'test',
    },
    explanation: {
      source: 'template',
      summary: 'Test summary.',
      whyItMatters: [],
      recommendedActions: ['Verify the employer.'],
    },
    findings: ['VirusTotal: 0 of 90.'],
    unknowns: ['The webpage itself was not inspected.'],
    limitations: ['Automated checks are limited.'],
    ...overrides,
  };
}
