import type { DomainCheck, Indicator, VirusTotalCheck } from '@radarjob/shared';
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
