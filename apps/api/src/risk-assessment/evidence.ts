import type { DomainCheck, Indicator, VirusTotalCheck, WebCheckCheck } from '@radarjob/shared';
import { totalEngines } from '../virustotal/virustotal.normalize';
import type { RiskRules } from './rules.config';

/** Convert VirusTotal statistics into indicators according to the configured thresholds. */
export function virusTotalIndicators(vt: VirusTotalCheck, rules: RiskRules): Indicator[] {
  if (vt.status !== 'completed' || !vt.stats) return [];
  const { malicious, suspicious } = vt.stats;
  const total = totalEngines(vt.stats);
  const engines = (vt.flaggedBy ?? [])
    .filter((f) => f.category === 'malicious')
    .slice(0, 5)
    .map((f) => f.engine)
    .join(', ');
  const base = {
    source: 'virustotal' as const,
    dimension: 'link' as const,
    basis: 'observed' as const,
  };
  if (malicious >= rules.virustotal.strongMaliciousCount) {
    return [
      {
        ...base,
        id: 'vt-malicious',
        category: 'reputation_malicious',
        title: `${malicious} of ${total} security vendors flag this link as malicious`,
        evidence: engines
          ? `Flagged by: ${engines}${malicious > 5 ? ', and others' : ''}`
          : `${malicious} malicious verdicts`,
        whyItMatters:
          'Several independent security vendors have identified this link as harmful (for example phishing or malware).',
        severity: 'strong',
      },
    ];
  }
  if (malicious >= rules.virustotal.moderateMaliciousCount) {
    return [
      {
        ...base,
        id: 'vt-malicious',
        category: 'reputation_malicious_few',
        title: `${malicious} of ${total} security vendors flag this link as malicious`,
        evidence: engines ? `Flagged by: ${engines}` : `${malicious} malicious verdict(s)`,
        whyItMatters:
          'At least one vendor considers this link harmful. A small number of detections can be a false positive or an early warning.',
        severity: 'moderate',
        limitations: 'One or two detections alone are not conclusive.',
      },
    ];
  }
  if (suspicious >= rules.virustotal.suspiciousCountForWeak) {
    return [
      {
        ...base,
        id: 'vt-suspicious',
        category: 'reputation_suspicious',
        title: `${suspicious} security vendor(s) rate this link as suspicious`,
        evidence: `${suspicious} suspicious verdict(s), 0 malicious`,
        whyItMatters:
          'Suspicious ratings are weaker than malicious ones but suggest vendors have seen something unusual.',
        severity: 'weak',
      },
    ];
  }
  return [];
}

export function domainIndicators(domain: DomainCheck, rules: RiskRules): Indicator[] {
  if (domain.status !== 'completed' || !domain.data) return [];
  const d = domain.data;
  const out: Indicator[] = [];
  if (d.ageDays !== undefined && d.ageDays < rules.domain.newDomainDays) {
    out.push({
      id: 'domain-new',
      source: 'domain',
      dimension: 'link',
      category: 'new_domain',
      title:
        d.ageDays < 1
          ? 'The domain was registered within the last day'
          : `The domain was registered only ${d.ageDays} day(s) ago`,
      evidence: `Registered ${d.createdAt?.slice(0, 10)}`,
      whyItMatters:
        'Scam sites are often set up shortly before use and abandoned quickly. A new domain also has little reputation history, so security vendors may not have assessed it yet.',
      basis: 'observed',
      severity: 'weak',
      limitations:
        'New businesses and new campaign sites are also recently registered. Domain age alone does not indicate fraud.',
    });
  }
  if (d.redacted) {
    out.push({
      id: 'domain-redacted',
      source: 'domain',
      dimension: 'link',
      category: 'registration_redacted',
      title: 'Registrant details are privacy-protected',
      evidence: "The registration record hides the owner's identity",
      whyItMatters: 'You cannot use the registration record to confirm who owns the site.',
      basis: 'observed',
      severity: 'info',
      limitations: 'Privacy protection is standard practice and is not evidence of fraud.',
    });
  }
  return out;
}

const TLS_ERRORS: Array<[RegExp, string]> = [
  [/EXPIRED/i, 'the certificate has expired'],
  [
    /SELF_SIGNED|SELF-SIGNED/i,
    'the certificate is self-signed, so no trusted authority vouches for it',
  ],
  [
    /ALTNAME|HOSTNAME|IP: .* is not in the cert/i,
    'the certificate was issued for a different website',
  ],
  [/NOT_YET_VALID/i, 'the certificate is not valid yet'],
  [
    /UNABLE_TO_GET_ISSUER|UNABLE_TO_VERIFY|LOCAL_ISSUER/i,
    'the certificate chain cannot be verified',
  ],
];

export function describeTlsError(code?: string): string {
  if (!code) return 'the certificate did not pass validation';
  return (
    TLS_ERRORS.find(([re]) => re.test(code))?.[1] ??
    `the certificate did not pass validation (${code})`
  );
}

/** Convert Web-Check results into indicators. Missing parts produce nothing (never a clean signal). */
export function webCheckIndicators(wc: WebCheckCheck | undefined, rules: RiskRules): Indicator[] {
  if (!wc || wc.status !== 'completed') return [];
  const out: Indicator[] = [];
  const base = {
    source: 'webcheck' as const,
    dimension: 'link' as const,
    basis: 'observed' as const,
  };
  const describe = (list: NonNullable<WebCheckCheck['threats']>) =>
    list.map((s) => (s.detail ? `${s.name} (${s.detail})` : s.name)).join('; ');

  const listed = (wc.threats ?? []).filter((s) => s.listed === true);
  const current = listed.filter((s) => !s.historical);
  const past = listed.filter((s) => s.historical);
  if (current.length) {
    out.push({
      ...base,
      id: 'webcheck-threat-feed',
      category: 'threat_feed_listed',
      title:
        current.length === 1
          ? `${current[0]!.name} lists this site as harmful`
          : `${current.length} threat-intelligence feeds list this site as harmful`,
      evidence: describe(current),
      whyItMatters:
        'Threat-intelligence feeds track websites confirmed to be used for phishing, malware or fraud. A listing is independent evidence, separate from VirusTotal.',
      severity: 'strong',
    });
  } else if (past.length) {
    out.push({
      ...base,
      id: 'webcheck-threat-history',
      category: 'threat_feed_history',
      title: 'This site was listed as harmful in the past',
      evidence: describe(past),
      whyItMatters:
        'A history of hosting malware or phishing suggests the site has been abused before and may be poorly secured or reused by attackers.',
      severity: 'moderate',
      limitations:
        'Sites are sometimes cleaned up after a compromise. A past listing is not proof of current harm.',
    });
  }

  const bl = wc.blocklists;
  if (bl && bl.securityBlockedBy.length) {
    const n = bl.securityBlockedBy.length;
    const moderate = n >= rules.webcheck.securityResolversForModerate;
    out.push({
      ...base,
      id: 'webcheck-dns-block',
      category: 'dns_security_block',
      title: `${n} of ${bl.securityChecked} security DNS filters block this domain`,
      evidence: `Blocked by: ${bl.securityBlockedBy.join(', ')}`,
      whyItMatters:
        'Security-focused DNS services refuse to resolve domains their threat intelligence associates with malware or phishing, to stop people reaching them.',
      severity: moderate ? 'moderate' : 'weak',
      limitations: moderate
        ? undefined
        : 'A single filter blocking a domain can be a false positive.',
    });
  }

  if (wc.tls && !wc.tls.valid) {
    out.push({
      ...base,
      id: 'webcheck-tls-invalid',
      category: 'tls_invalid',
      title: "The site's HTTPS certificate is not valid",
      evidence: `On inspection, ${describeTlsError(wc.tls.error)}.`,
      whyItMatters:
        'A valid certificate confirms you are connected to the website named in the address. Without one, browsers show a warning and the connection may not be private — do not enter personal details.',
      severity: 'moderate',
      limitations:
        'Legitimate sites occasionally let certificates lapse by mistake. It is still unsafe to enter personal information until it is fixed.',
    });
  }
  return out;
}
