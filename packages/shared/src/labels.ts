import type { CheckStatus, RiskCategory, Severity } from './schemas/report';

export const CATEGORY_LABELS: Record<RiskCategory, string> = {
  potentially_malicious: 'Potentially malicious',
  suspicious: 'Suspicious — investigate further',
  no_significant_threats: 'No significant threats detected',
  inconclusive: 'Inconclusive — insufficient evidence',
};

/** Labels used for the job-offer dimension, where "malicious" reads oddly. */
export const OFFER_CATEGORY_LABELS: Record<RiskCategory, string> = {
  potentially_malicious: 'Strong scam warning signs',
  suspicious: 'Warning signs — investigate further',
  no_significant_threats: 'No significant red flags found in the text',
  inconclusive: 'Inconclusive',
};

export const CATEGORY_DESCRIPTIONS: Record<RiskCategory, string> = {
  potentially_malicious:
    'Strong threat evidence was found. Avoid this link and do not share personal or financial information.',
  suspicious:
    'Meaningful warning signs were found, but the evidence does not prove the link is malicious. Verify independently before going further.',
  no_significant_threats:
    'The checks that ran did not find significant threats. This does not guarantee that the website or the job offer is legitimate.',
  inconclusive:
    'Important checks could not be completed, or the signals were too weak or contradictory to assess.',
};

export const CHECK_STATUS_LABELS: Record<CheckStatus, string> = {
  pending: 'Waiting',
  running: 'Running',
  completed: 'Completed',
  failed: 'Failed',
  unavailable: 'Unavailable',
  not_configured: 'Not configured',
  skipped: 'Not performed',
};

export const SEVERITY_LABELS: Record<Severity, string> = {
  strong: 'Strong warning',
  moderate: 'Warning',
  weak: 'Minor signal',
  info: 'For information',
};
