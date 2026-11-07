import type {
  Assessment,
  DomainCheck,
  Indicator,
  RiskCategory,
  VirusTotalCheck,
} from '@radarjob/shared';
import { DEFAULT_RULES, type RiskRules } from './rules.config';

/**
 * Deterministic risk-assessment engine.
 *
 * It combines indicators from every source into one of four categories. AI
 * output can only contribute indicators (capped at "moderate" severity and
 * never counted as an independent source for "potentially malicious"); it can
 * never set or change the category. Failed checks are never treated as clean.
 */

export interface RiskInput {
  vt: VirusTotalCheck;
  domain: DomainCheck;
  indicators: Indicator[];
  jobAdSupplied: boolean;
}

const AI_SOURCES = new Set(['url_ai', 'job_ad_ai']);

const RANK: Record<RiskCategory, number> = {
  no_significant_threats: 0,
  inconclusive: 1,
  suspicious: 2,
  potentially_malicious: 3,
};

export function mostSevere(a: RiskCategory, b: RiskCategory): RiskCategory {
  return RANK[a] >= RANK[b] ? a : b;
}

function titles(list: Indicator[], max = 3): string {
  const t = list.slice(0, max).map((i) => i.title);
  return t.join('; ') + (list.length > max ? `; and ${list.length - max} more` : '');
}

function assessLink(input: RiskInput, rules: RiskRules, reasons: string[]): RiskCategory {
  const link = input.indicators.filter((i) => i.dimension === 'link');
  const strong = link.filter((i) => i.severity === 'strong');
  const moderate = link.filter((i) => i.severity === 'moderate');
  const weak = link.filter((i) => i.severity === 'weak');

  if (strong.length) {
    reasons.push(`Strong threat evidence: ${titles(strong)}.`);
    return 'potentially_malicious';
  }
  const independentSources = new Set(
    moderate.filter((i) => !AI_SOURCES.has(i.source)).map((i) => i.source),
  );
  if (independentSources.size >= rules.independentModerateSourcesForMalicious) {
    reasons.push(`Several independent checks found warning signs: ${titles(moderate)}.`);
    return 'potentially_malicious';
  }
  if (moderate.length) {
    reasons.push(`Warning signs found: ${titles(moderate)}.`);
    return 'suspicious';
  }
  if (weak.length >= rules.weakSignalsForSuspicious) {
    reasons.push(`Several minor signals together warrant caution: ${titles(weak)}.`);
    return 'suspicious';
  }
  if (input.vt.status !== 'completed') {
    reasons.push(
      'The VirusTotal reputation check did not complete, and the remaining checks were not enough for a reliable assessment.',
    );
    return 'inconclusive';
  }
  if (weak.length) {
    reasons.push(
      `Only minor signals were found (${titles(weak)}). On their own they do not indicate a threat.`,
    );
  } else {
    reasons.push('The checks that ran did not find significant technical threats in the link.');
  }
  return 'no_significant_threats';
}

function assessOffer(input: RiskInput, reasons: string[]): RiskCategory | null {
  const offer = input.indicators.filter((i) => i.dimension === 'offer');
  if (!offer.length && !input.jobAdSupplied) return null;
  const strong = offer.filter((i) => i.severity === 'strong');
  const moderate = offer.filter((i) => i.severity === 'moderate');
  const weak = offer.filter((i) => i.severity === 'weak');
  if (strong.length) {
    reasons.push(`The job offer shows strong scam warning signs: ${titles(strong)}.`);
    return 'potentially_malicious';
  }
  if (moderate.length || weak.length >= 2) {
    reasons.push(`The job offer shows warning signs: ${titles([...moderate, ...weak])}.`);
    return 'suspicious';
  }
  if (weak.length) reasons.push(`The job text contains a minor signal: ${titles(weak)}.`);
  return 'no_significant_threats';
}

function conflicts(
  input: RiskInput,
  link: RiskCategory,
  offer: RiskCategory | null,
  rules: RiskRules,
): string[] {
  const out: string[] = [];
  const vt = input.vt;
  const clean =
    vt.status === 'completed' && vt.stats && vt.stats.malicious === 0 && vt.stats.suspicious === 0;
  const linkWarnings = input.indicators.filter(
    (i) =>
      i.dimension === 'link' &&
      i.source !== 'virustotal' &&
      (i.severity === 'moderate' || i.severity === 'strong'),
  );
  if (clean && linkWarnings.length) {
    out.push(
      'No security vendor on VirusTotal has flagged this link, but other checks found warning signs. Newly created phishing sites often have no detections yet, so a clean reputation result does not cancel the other evidence.',
    );
  }
  const age = input.domain.data?.ageDays;
  if (
    vt.stats &&
    vt.stats.malicious > 0 &&
    age !== undefined &&
    age >= rules.domain.establishedDays
  ) {
    out.push(
      `Security vendors flag this link even though the domain has been registered for about ${Math.floor(age / 365)} years. Long-established sites can be compromised or misclassified, so the specific page may be harmful even if the organisation is genuine.`,
    );
  }
  if (offer && RANK[offer] >= RANK.suspicious && link === 'no_significant_threats') {
    out.push(
      'The website itself shows no significant technical threats, but the job offer contains red flags. Scams are often posted on legitimate platforms — the platform being safe does not make the offer genuine.',
    );
  }
  if (offer === 'no_significant_threats' && RANK[link] >= RANK.suspicious) {
    out.push(
      'The job text looks ordinary, but the link shows warning signs. Scammers often copy genuine advert text.',
    );
  }
  return out;
}

export function assessRisk(input: RiskInput, rules: RiskRules = DEFAULT_RULES): Assessment {
  const reasons: string[] = [];
  const link = assessLink(input, rules, reasons);
  const offer = assessOffer(input, reasons);
  let category = offer ? mostSevere(link, offer) : link;
  // A clean offer cannot make an inconclusive link look safe, and vice versa.
  if (offer === 'no_significant_threats' && link === 'inconclusive') category = 'inconclusive';
  return {
    category,
    link,
    offer,
    reasons,
    conflicts: conflicts(input, link, offer, rules),
    rulesVersion: rules.version,
  };
}

/** Assess job-advert text on its own (used by the standalone job-ad endpoint). */
export function assessOfferIndicators(indicators: Indicator[]): {
  category: RiskCategory;
  reasons: string[];
} {
  const reasons: string[] = [];
  const category =
    assessOffer(
      { vt: { status: 'skipped' }, domain: { status: 'skipped' }, indicators, jobAdSupplied: true },
      reasons,
    ) ?? 'no_significant_threats';
  return { category, reasons };
}
