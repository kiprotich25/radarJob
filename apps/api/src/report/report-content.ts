import {
  CATEGORY_LABELS,
  OFFER_CATEGORY_LABELS,
  type AnalysisReport,
  type Assessment,
  type Explanation,
  type RiskCategory,
} from '@radarjob/shared';
import { totalEngines } from '../virustotal/virustotal.normalize';

type Checks = AnalysisReport['checks'];

const fmtDate = (iso?: string) => (iso ? iso.slice(0, 10) : 'unknown date');

/** Facts actually observed, in plain language. Never includes interpretation. */
export function buildFindings(checks: Checks): string[] {
  const out: string[] = [];
  const vt = checks.virustotal;
  if (vt.status === 'completed' && vt.stats) {
    const s = vt.stats;
    out.push(
      `VirusTotal: ${s.malicious} of ${totalEngines(s)} security vendors flagged this link as malicious and ${s.suspicious} as suspicious (${s.harmless} harmless, ${s.undetected} undetected). Analysis date: ${fmtDate(vt.analysisDate)}${vt.origin === 'existing_report' ? ' (existing VirusTotal report)' : ' (new scan)'}.`,
    );
  }
  const d = checks.domain;
  if (d.status === 'completed' && d.data) {
    const parts = [`Domain ${d.data.unicodeDomain}`];
    if (d.data.createdAt)
      parts.push(
        `registered on ${fmtDate(d.data.createdAt)}${d.data.ageDays !== undefined ? ` (about ${d.data.ageDays} days ago)` : ''}`,
      );
    else parts.push('registration date not published');
    if (d.data.registrar) parts.push(`through ${d.data.registrar}`);
    out.push(`${parts.join(', ')}.`);
    if (d.data.expiresAt)
      out.push(`The domain registration expires on ${fmtDate(d.data.expiresAt)}.`);
  }
  const p = checks.page;
  if (p.status === 'completed') {
    const bits = [`The webpage was inspected${p.finalHost ? ` at ${p.finalHost}` : ''}`];
    if (p.httpStatus)
      bits.push(
        `(HTTP ${p.httpStatus}${p.redirectCount ? `, after ${p.redirectCount} redirect(s)` : ''})`,
      );
    out.push(`${bits.join(' ')}.`);
    if (p.pageTitle) out.push(`Page title: "${p.pageTitle}".`);
    if (p.formCount !== undefined)
      out.push(
        `The page contains ${p.formCount} form(s) and ${p.passwordFields ?? 0} password field(s).`,
      );
  }
  return out;
}

export function buildUnknowns(checks: Checks, jobAdSupplied: boolean): string[] {
  const out: string[] = [];
  const vt = checks.virustotal;
  if (vt.status !== 'completed') {
    out.push(
      `URL reputation (VirusTotal) was not checked: ${vt.message ?? 'the check did not complete.'} This is not the same as a clean result.`,
    );
  }
  const d = checks.domain;
  if (d.status !== 'completed') {
    out.push(
      `Domain registration details were not available: ${d.message ?? 'the lookup did not complete.'}`,
    );
  } else if (d.data && !d.data.createdAt) {
    out.push("The domain's registration date was not published, so its age is unknown.");
  }
  if (checks.page.status !== 'completed') {
    const msg = checks.page.message ?? '';
    out.push(
      /not inspected/i.test(msg) ? msg : `The webpage itself was not inspected. ${msg}`.trim(),
    );
  }
  if (checks.urlAi.status !== 'completed') {
    out.push('AI-assisted URL pattern analysis did not run; the rule-based URL checks still ran.');
  }
  if (!jobAdSupplied) {
    out.push(
      'No job advert or recruiter message was provided, so the offer itself was not analysed.',
    );
  } else if (checks.jobAd.status !== 'completed') {
    out.push(`The job text analysis did not complete: ${checks.jobAd.message ?? ''}`.trim());
  }
  out.push("RadarJob did not verify the employer's identity or confirm that the job exists.");
  return out;
}

export const STANDARD_LIMITATIONS = [
  'Automated checks detect technical warning signs; they cannot prove that a job offer is fraudulent or genuine.',
  'A link with no detections can still be dangerous — new phishing sites often have no reputation history yet.',
  "A legitimate website can host a fraudulent advert, and a scam can use a genuine employer's name.",
  'Results reflect the moment of analysis. Websites can change after they are checked.',
];

const ACTIONS: Record<RiskCategory, string[]> = {
  potentially_malicious: [
    'Do not open this link, and do not enter any passwords, PINs, codes, ID details or payment information on it.',
    'Do not pay any fee connected to this opportunity.',
    'If you already entered information, change your passwords now and contact your bank or mobile-money provider if you shared financial details.',
    'Report the link to the platform where you found it and to the National KE-CIRT/CC.',
  ],
  suspicious: [
    "Pause before applying. Find the employer's official website yourself and check whether the same vacancy is listed there.",
    'Contact the employer using details from its official website — not the contact details in the advert.',
    'Do not pay any fee or share passwords, PINs, one-time codes or ID copies until the employer is verified.',
  ],
  no_significant_threats: [
    'Still verify the employer independently: check its official website and contact details.',
    'Never pay to apply, and never share PINs, passwords or one-time codes with a recruiter.',
    'If anything about the offer changes — such as a sudden fee — stop and check again.',
  ],
  inconclusive: [
    'Treat this link with caution because key checks could not be completed.',
    'Try the analysis again later, and verify the employer through its official website in the meantime.',
    'Do not pay any fee or share sensitive information until you have verified the opportunity.',
  ],
};

export function recommendedActions(assessment: Assessment): string[] {
  const list = [...ACTIONS[assessment.category]];
  if (assessment.offer && assessment.offer !== 'no_significant_threats') {
    list.push(
      'Legitimate employers do not charge you to be hired. If an agency is involved, check that it is registered with the National Employment Authority.',
    );
  }
  return list;
}

/** Deterministic explanation used when no AI provider is configured or the AI response fails validation. */
export function templateExplanation(assessment: Assessment, checks: Checks): Explanation {
  const sentences: string[] = [];
  const label = CATEGORY_LABELS[assessment.category];
  sentences.push(`Overall assessment: ${label}.`);
  const vt = checks.virustotal;
  if (vt.status === 'completed' && vt.stats) {
    sentences.push(
      vt.stats.malicious > 0
        ? `${vt.stats.malicious} security vendor(s) on VirusTotal flag this link as malicious.`
        : 'No security vendor on VirusTotal currently flags this link — which does not by itself mean it is safe.',
    );
  } else {
    sentences.push(
      'The VirusTotal reputation check could not be completed, so that evidence is missing.',
    );
  }
  if (assessment.reasons[0]) sentences.push(assessment.reasons[0]);
  if (assessment.offer) sentences.push(`Job offer: ${OFFER_CATEGORY_LABELS[assessment.offer]}.`);
  const why: string[] = [];
  if (assessment.category === 'potentially_malicious' || assessment.category === 'suspicious') {
    why.push(
      'Fake job links are used to steal passwords and identity details, or to collect "fees" for jobs that do not exist.',
    );
  }
  why.push(...assessment.conflicts);
  if (assessment.category === 'no_significant_threats') {
    why.push(
      'Most job scams succeed through the offer itself — fees, pressure and requests for personal information — rather than through technical attacks.',
    );
  }
  if (assessment.category === 'inconclusive') {
    why.push(
      'When important checks are missing, the safest approach is to verify the opportunity independently before acting on it.',
    );
  }
  return {
    source: 'template',
    summary: sentences.join(' '),
    whyItMatters: why,
    recommendedActions: recommendedActions(assessment),
  };
}
