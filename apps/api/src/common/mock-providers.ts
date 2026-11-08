import type { DomainCheck, VirusTotalCheck, WebCheckCheck } from '@radarjob/shared';
import type { ReputationProvider } from '../virustotal/reputation.provider';
import type { DomainIntelProvider } from '../domain-intelligence/domain-intel.provider';
import type { WebCheckProvider } from '../webcheck/webcheck.service';

/**
 * DEVELOPMENT-ONLY mock providers.
 * Enabled with DEV_MOCK_PROVIDERS=true and refused at startup when NODE_ENV=production.
 * Every report that uses them is flagged `simulated: true` and shown with a prominent banner.
 *
 * Behaviour is driven by keywords so you can exercise every path:
 *   mock-malicious  (anywhere in the hostname)  → several VirusTotal detections
 *   mock-vt-down    (anywhere in the hostname)  → VirusTotal unavailable
 *   mock-new        (in the registered domain, e.g. mock-new-jobs.com) → registered 5 days ago
 *   mock-whois-down (in the registered domain)  → domain lookup unavailable
 *   mock-malicious  (with WEBCHECK_ENABLED=true) → listed by threat feeds and DNS filters
 *   mock-webcheck-down (anywhere in the hostname) → Web-Check unavailable
 */
export const SIMULATED_NOTE = 'SIMULATED development data — not a real result.';

export class MockReputationProvider implements ReputationProvider {
  readonly mode = 'mock' as const;

  async check(normalizedUrl: string): Promise<VirusTotalCheck> {
    const host = new URL(normalizedUrl).hostname;
    if (host.includes('mock-vt-down')) {
      return {
        status: 'unavailable',
        message: `VirusTotal is temporarily unavailable. (${SIMULATED_NOTE})`,
      };
    }
    const malicious = host.includes('mock-malicious');
    return {
      status: 'completed',
      origin: 'existing_report',
      analysisDate: new Date().toISOString(),
      stats: malicious
        ? { malicious: 7, suspicious: 1, harmless: 58, undetected: 25, timeout: 0 }
        : { malicious: 0, suspicious: 0, harmless: 66, undetected: 25, timeout: 0 },
      flaggedBy: malicious
        ? [
            { engine: 'MockEngine A', category: 'malicious', result: 'phishing' },
            { engine: 'MockEngine B', category: 'malicious', result: 'phishing' },
          ]
        : [],
      message: SIMULATED_NOTE,
    };
  }
}

export class MockDomainIntelProvider implements DomainIntelProvider {
  readonly mode = 'mock' as const;
  readonly providerName = 'Mock domain provider (development only)';

  async lookup(domain: string, unicodeDomain: string): Promise<DomainCheck> {
    if (domain.includes('mock-whois-down')) {
      return {
        status: 'unavailable',
        provider: this.providerName,
        message: `Domain lookup unavailable. (${SIMULATED_NOTE})`,
      };
    }
    const ageDays = domain.includes('mock-new') ? 5 : 2200;
    const created = new Date(Date.now() - ageDays * 86_400_000);
    return {
      status: 'completed',
      provider: this.providerName,
      message: SIMULATED_NOTE,
      data: {
        domain,
        unicodeDomain,
        createdAt: created.toISOString(),
        updatedAt: created.toISOString(),
        expiresAt: new Date(
          created.getTime() + 365 * 86_400_000 * (ageDays > 365 ? 8 : 1),
        ).toISOString(),
        ageDays,
        registrar: 'Mock Registrar Ltd (simulated)',
        nameservers: ['ns1.mock.invalid', 'ns2.mock.invalid'],
        statuses: ['client transfer prohibited'],
        redacted: true,
      },
    };
  }
}

export class MockWebCheckProvider implements WebCheckProvider {
  readonly mode = 'mock' as const;
  readonly enabled = true;

  async check(normalizedUrl: string): Promise<WebCheckCheck> {
    const host = new URL(normalizedUrl).hostname;
    const provider = 'Mock Web-Check (development only)';
    if (host.includes('mock-webcheck-down')) {
      return {
        status: 'unavailable',
        provider,
        message: `Web-Check could not be reached. (${SIMULATED_NOTE})`,
      };
    }
    const bad = host.includes('mock-malicious');
    return {
      status: 'completed',
      provider,
      message: SIMULATED_NOTE,
      threats: [
        {
          name: 'Google Safe Browsing',
          listed: bad,
          detail: bad ? 'Threat type: social engineering' : undefined,
        },
        { name: 'URLhaus', listed: false },
        { name: 'NetAPI compromised-sites feed', listed: false },
      ],
      blocklists: {
        securityBlockedBy: bad ? ['Quad9', 'CleanBrowsing Security'] : [],
        securityChecked: 3,
        otherBlockedBy: [],
      },
      tls: {
        valid: true,
        issuer: 'Mock CA (simulated)',
        validTo: new Date(Date.now() + 60 * 86_400_000).toISOString(),
      },
      rank: bad ? {} : { position: 4321 },
    };
  }
}
