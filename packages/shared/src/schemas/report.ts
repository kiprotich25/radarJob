import { z } from 'zod';

/**
 * Shared API contract between the RadarJob API and web app.
 * These schemas describe what the backend returns; the web app validates
 * responses against them so a malformed payload is shown as an error rather
 * than silently rendered.
 */

export const RISK_CATEGORIES = [
  'potentially_malicious',
  'suspicious',
  'no_significant_threats',
  'inconclusive',
] as const;
export const RiskCategorySchema = z.enum(RISK_CATEGORIES);
export type RiskCategory = z.infer<typeof RiskCategorySchema>;

/** Status of an individual check. "not_configured" and "failed" are never a clean result. */
export const CHECK_STATUSES = [
  'pending',
  'running',
  'completed',
  'failed',
  'unavailable',
  'not_configured',
  'skipped',
] as const;
export const CheckStatusSchema = z.enum(CHECK_STATUSES);
export type CheckStatus = z.infer<typeof CheckStatusSchema>;

export const SeveritySchema = z.enum(['strong', 'moderate', 'weak', 'info']);
export type Severity = z.infer<typeof SeveritySchema>;

export const IndicatorSourceSchema = z.enum([
  'virustotal',
  'domain',
  'url_heuristic',
  'url_ai',
  'page',
  'job_ad',
  'job_ad_ai',
  'webcheck',
]);
export type IndicatorSource = z.infer<typeof IndicatorSourceSchema>;

/** One explainable piece of evidence. */
export const IndicatorSchema = z.object({
  id: z.string(),
  source: IndicatorSourceSchema,
  /** Which question the indicator speaks to: the link itself or the job offer. */
  dimension: z.enum(['link', 'offer']),
  category: z.string(),
  title: z.string(),
  /** What was actually observed (a quote, a hostname fragment, a count). */
  evidence: z.string(),
  whyItMatters: z.string(),
  /** observed = seen directly in data; inferred = an interpretation of data. */
  basis: z.enum(['observed', 'inferred']),
  severity: SeveritySchema,
  limitations: z.string().optional(),
});
export type Indicator = z.infer<typeof IndicatorSchema>;

export const VtStatsSchema = z.object({
  malicious: z.number().int().nonnegative(),
  suspicious: z.number().int().nonnegative(),
  harmless: z.number().int().nonnegative(),
  undetected: z.number().int().nonnegative(),
  timeout: z.number().int().nonnegative(),
});
export type VtStats = z.infer<typeof VtStatsSchema>;

export const VirusTotalCheckSchema = z.object({
  status: CheckStatusSchema,
  /** Present only when VirusTotal actually returned statistics. */
  stats: VtStatsSchema.optional(),
  analysisDate: z.string().optional(),
  /** existing_report = VirusTotal already had a report; new_scan = we submitted the URL. */
  origin: z.enum(['existing_report', 'new_scan']).optional(),
  flaggedBy: z
    .array(z.object({ engine: z.string(), category: z.string(), result: z.string().optional() }))
    .optional(),
  message: z.string().optional(),
});
export type VirusTotalCheck = z.infer<typeof VirusTotalCheckSchema>;

export const DomainDataSchema = z.object({
  domain: z.string(),
  unicodeDomain: z.string(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  expiresAt: z.string().optional(),
  ageDays: z.number().int().optional(),
  registrar: z.string().optional(),
  nameservers: z.array(z.string()),
  statuses: z.array(z.string()),
  redacted: z.boolean(),
});
export type DomainData = z.infer<typeof DomainDataSchema>;

export const DomainCheckSchema = z.object({
  status: CheckStatusSchema,
  provider: z.string().optional(),
  data: DomainDataSchema.optional(),
  message: z.string().optional(),
});
export type DomainCheck = z.infer<typeof DomainCheckSchema>;

export const PageCheckSchema = z.object({
  status: CheckStatusSchema,
  finalHost: z.string().optional(),
  httpStatus: z.number().int().optional(),
  redirectCount: z.number().int().optional(),
  pageTitle: z.string().optional(),
  passwordFields: z.number().int().optional(),
  formCount: z.number().int().optional(),
  message: z.string().optional(),
});
export type PageCheck = z.infer<typeof PageCheckSchema>;

/**
 * Web-Check (https://web-check.xyz) results: threat-feed listings, security DNS
 * block lists, the TLS certificate and Tranco popularity rank. Each part is
 * optional because Web-Check runs them independently and any one can fail.
 */
export const WebCheckThreatSourceSchema = z.object({
  name: z.string(),
  /** true = listed as harmful, false = checked and not listed, null = could not be checked. */
  listed: z.boolean().nullable(),
  /** Listed in the past but not currently (e.g. the malware URLs are offline). */
  historical: z.boolean().optional(),
  detail: z.string().optional(),
});
export type WebCheckThreatSource = z.infer<typeof WebCheckThreatSourceSchema>;

export const WebCheckCheckSchema = z.object({
  status: CheckStatusSchema,
  provider: z.string().optional(),
  threats: z.array(WebCheckThreatSourceSchema).optional(),
  blocklists: z
    .object({
      /** Security-focused resolvers (malware/phishing filtering) that block the domain. */
      securityBlockedBy: z.array(z.string()),
      securityChecked: z.number().int().nonnegative(),
      /** Family/adult/ad filters that block the domain — informational only. */
      otherBlockedBy: z.array(z.string()),
    })
    .optional(),
  tls: z
    .object({
      valid: z.boolean(),
      error: z.string().optional(),
      issuer: z.string().optional(),
      validFrom: z.string().optional(),
      validTo: z.string().optional(),
    })
    .optional(),
  rank: z
    .object({
      /** Best Tranco rank, or undefined when the site is not in the top 1 million. */
      position: z.number().int().positive().optional(),
    })
    .optional(),
  message: z.string().optional(),
});
export type WebCheckCheck = z.infer<typeof WebCheckCheckSchema>;

export const SimpleCheckSchema = z.object({
  status: CheckStatusSchema,
  message: z.string().optional(),
});
export type SimpleCheck = z.infer<typeof SimpleCheckSchema>;

export const AssessmentSchema = z.object({
  category: RiskCategorySchema,
  link: RiskCategorySchema,
  /** Null when no job-advert text was supplied. */
  offer: RiskCategorySchema.nullable(),
  reasons: z.array(z.string()),
  conflicts: z.array(z.string()),
  rulesVersion: z.string(),
});
export type Assessment = z.infer<typeof AssessmentSchema>;

export const ExplanationSchema = z.object({
  source: z.enum(['ai', 'template']),
  summary: z.string(),
  whyItMatters: z.array(z.string()),
  recommendedActions: z.array(z.string()),
});
export type Explanation = z.infer<typeof ExplanationSchema>;

export const ReportInputSchema = z.object({
  /** Scheme, host and path only — query strings and fragments are never stored or shown. */
  displayUrl: z.string(),
  hostname: z.string(),
  unicodeHostname: z.string(),
  registeredDomain: z.string().nullable(),
  hadQuery: z.boolean(),
  jobAdSupplied: z.boolean(),
});

export const ReportSchema = z.object({
  id: z.string(),
  status: z.enum(['running', 'completed', 'failed']),
  createdAt: z.string(),
  completedAt: z.string().optional(),
  /** True when development mock providers produced any of the data. Never true in production. */
  simulated: z.boolean(),
  input: ReportInputSchema,
  checks: z.object({
    virustotal: VirusTotalCheckSchema,
    domain: DomainCheckSchema,
    urlHeuristics: SimpleCheckSchema,
    urlAi: SimpleCheckSchema,
    page: PageCheckSchema,
    jobAd: SimpleCheckSchema,
    /** Optional so reports saved before this check existed still validate. */
    webCheck: WebCheckCheckSchema.optional(),
  }),
  indicators: z.array(IndicatorSchema),
  assessment: AssessmentSchema.optional(),
  explanation: ExplanationSchema.optional(),
  findings: z.array(z.string()),
  unknowns: z.array(z.string()),
  limitations: z.array(z.string()),
  error: z.string().optional(),
});
export type AnalysisReport = z.infer<typeof ReportSchema>;

export const CreateAnalysisResponseSchema = z.object({
  id: z.string(),
  status: z.enum(['running', 'completed', 'failed']),
});
export type CreateAnalysisResponse = z.infer<typeof CreateAnalysisResponseSchema>;

export const JobAdReportSchema = z.object({
  category: RiskCategorySchema,
  indicators: z.array(IndicatorSchema),
  aiStatus: CheckStatusSchema,
  explanation: ExplanationSchema,
  limitations: z.array(z.string()),
  simulated: z.boolean(),
});
export type JobAdReport = z.infer<typeof JobAdReportSchema>;

export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.array(z.string()).optional(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

export const HealthSchema = z.object({
  status: z.literal('ok'),
  time: z.string(),
  integrations: z.object({
    virustotal: z.enum(['configured', 'not_configured', 'mock']),
    domainIntelligence: z.enum(['configured', 'not_configured', 'mock']),
    domainProvider: z.string(),
    ai: z.enum(['configured', 'not_configured', 'mock']),
    aiProvider: z.string(),
    pageInspection: z.enum(['enabled', 'disabled']),
    webCheck: z.enum(['configured', 'not_configured', 'mock']).optional(),
    persistence: z.enum(['postgres', 'memory']),
  }),
});
export type Health = z.infer<typeof HealthSchema>;

export const JOB_AD_MAX_LENGTH = 6000;
