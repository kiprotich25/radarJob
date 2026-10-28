import { createHash } from 'node:crypto';
import { Logger } from '@nestjs/common';
import { z } from 'zod';
import {
  CATEGORY_LABELS,
  OFFER_CATEGORY_LABELS,
  type Assessment,
  type CheckStatus,
  type Explanation,
  type Indicator,
  type IndicatorSource,
} from '@radarjob/shared';
import { isProviderError } from '../common/provider-error';
import { cleanText } from '../common/redact';
import { TtlCache } from '../common/ttl-cache';
import type { IntegrationMode } from '../virustotal/reputation.provider';
import type { LlmClient } from './llm-client';
import {
  JOB_AD_INDICATORS_SYSTEM,
  SUMMARY_SYSTEM,
  URL_INDICATORS_SYSTEM,
  wrapUntrusted,
} from './prompts';

export const AI_SERVICE = Symbol('AI_SERVICE');

const AiIndicatorSchema = z.object({
  category: z.string().min(1).max(60),
  title: z.string().min(3).max(160),
  evidence: z.string().min(1).max(300),
  whyItMatters: z.string().min(3).max(500),
  basis: z.enum(['observed', 'inferred']),
  severity: z.enum(['weak', 'moderate', 'strong', 'info']),
  limitations: z.string().max(400).optional(),
});
const AiIndicatorsSchema = z.object({ indicators: z.array(AiIndicatorSchema).max(10) });

const AiSummarySchema = z.object({
  summary: z.string().min(20).max(1200),
  whyItMatters: z.array(z.string().min(3).max(400)).max(5),
  additionalActions: z.array(z.string().min(3).max(300)).max(5).default([]),
});

export interface AiResult {
  status: CheckStatus;
  message?: string;
  indicators: Indicator[];
}

export interface UrlAiInput {
  hostname: string;
  unicodeHostname: string;
  registeredDomain: string | null;
  path: string;
  existing: Indicator[];
  pageTitle?: string;
  pageExcerpt?: string;
}

export interface SummaryInput {
  assessment: Assessment;
  findings: string[];
  unknowns: string[];
  indicators: Indicator[];
  pageInspected: boolean;
}

/** Extract the JSON object from a model response (tolerates code fences). */
export function extractJson(text: string): unknown {
  const stripped = text.replace(/```(?:json)?/gi, '');
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('no JSON object in response');
  return JSON.parse(stripped.slice(start, end + 1));
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/^["'“”‘’…\s]+|["'“”‘’…\s]+$/g, '')
    .replace(/\s+/g, ' ');

/** Phrases the summary must never contain (false guarantees or invented inspection). */
const FORBIDDEN_ALWAYS = [
  /\b(is|are|looks|seems)\s+(completely\s+|totally\s+|definitely\s+|100%\s+)?(safe|legitimate|genuine|trustworthy|legit)\b/i,
  /\bsafe\s+to\s+(apply|use|proceed|click|open)\b/i,
];
const FORBIDDEN_WITHOUT_PAGE = [
  /\b(we|radarjob|i)\s+(visited|inspected|reviewed|opened|loaded|examined|browsed)\b/i,
  /\bthe\s+(page|website|site)\s+(contains|shows|displays|asks|requests|has a)\b/i,
];

/** True when the text promises a guarantee ("guaranteed safe") rather than denying one ("not a guarantee"). */
export function claimsGuarantee(text: string): boolean {
  const re = /\bguarantee[sd]?\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const before = text.slice(Math.max(0, m.index - 25), m.index).toLowerCase();
    if (!/\b(not|no|never|cannot|can't|isn't|doesn't|without)\b/.test(before)) return true;
  }
  return false;
}

/**
 * AI-assisted analysis. Every response is schema-validated and post-checked:
 * evidence must literally appear in the input, severity is capped at
 * "moderate", and summaries containing false guarantees are rejected in
 * favour of the deterministic template.
 */
export class AiService {
  private readonly logger = new Logger('AI');
  private readonly summaryCache = new TtlCache<Explanation>(30 * 60_000, 500);

  constructor(
    private readonly client: LlmClient | null,
    readonly mode: IntegrationMode,
    readonly providerLabel: string,
  ) {}

  get configured(): boolean {
    return this.client !== null;
  }

  private notConfigured(): AiResult {
    return {
      status: 'not_configured',
      message: 'No AI provider is configured on this server.',
      indicators: [],
    };
  }

  private async callJson<T>(
    system: string,
    user: string,
    schema: z.ZodType<T>,
    maxTokens: number,
  ): Promise<T> {
    if (!this.client) throw new Error('AI not configured');
    const text = await this.client.complete({ system, user, maxTokens });
    let json: unknown;
    try {
      json = extractJson(text);
    } catch {
      throw new Error('AI response was not valid JSON');
    }
    const parsed = schema.safeParse(json);
    if (!parsed.success) throw new Error('AI response failed schema validation');
    return parsed.data;
  }

  private failure(e: unknown, what: string): AiResult {
    const reason = isProviderError(e) ? e.kind : e instanceof Error ? e.message : 'error';
    this.logger.warn(`${what} failed: ${reason}`);
    const unavailable =
      isProviderError(e) && ['timeout', 'unavailable', 'rate_limited'].includes(e.kind);
    return {
      status: unavailable ? 'unavailable' : 'failed',
      message: unavailable
        ? 'The AI service was unavailable.'
        : 'The AI response could not be validated and was discarded.',
      indicators: [],
    };
  }

  private toIndicators(
    raw: z.infer<typeof AiIndicatorSchema>[],
    corpus: string,
    existing: Indicator[],
    source: IndicatorSource,
    dimension: 'link' | 'offer',
  ): Indicator[] {
    const haystack = norm(corpus);
    const seen = new Set(existing.map((i) => i.category));
    const out: Indicator[] = [];
    for (const r of raw) {
      const ev = norm(r.evidence);
      // Reject anything the model could not have observed in the data we gave it.
      if (ev.length < 2 || !haystack.includes(ev)) continue;
      if (seen.has(r.category)) continue;
      seen.add(r.category);
      out.push({
        id: `${source}-${out.length + 1}`,
        source,
        dimension,
        category: cleanText(r.category, 60),
        title: cleanText(r.title, 160),
        evidence: `"${cleanText(r.evidence, 200)}"`,
        whyItMatters: cleanText(r.whyItMatters, 400),
        basis: r.basis,
        // AI may never contribute "strong" evidence; it supplements, it does not decide.
        severity: r.severity === 'strong' ? 'moderate' : r.severity,
        limitations: cleanText(
          r.limitations ??
            'AI-identified pattern based on the address and available text; it is an interpretation, not a confirmed detection.',
          300,
        ),
      });
      if (out.length >= 4) break;
    }
    return out;
  }

  async analyzeUrl(input: UrlAiInput): Promise<AiResult> {
    if (!this.client) return this.notConfigured();
    const features = {
      hostname: input.hostname,
      unicodeHostname: input.unicodeHostname,
      registeredDomain: input.registeredDomain,
      path: input.path,
      alreadyFound: input.existing.map((i) => ({ category: i.category, title: i.title })),
    };
    const user = [
      'URL features (query string removed for privacy):',
      wrapUntrusted('url', JSON.stringify(features, null, 2)),
      input.pageTitle || input.pageExcerpt
        ? `Page content excerpt (personal data redacted):\n${wrapUntrusted('webpage', `TITLE: ${input.pageTitle ?? ''}\n${input.pageExcerpt ?? ''}`)}`
        : 'The page itself was NOT inspected. Do not describe its contents.',
    ].join('\n\n');
    try {
      const res = await this.callJson(URL_INDICATORS_SYSTEM, user, AiIndicatorsSchema, 900);
      const corpus = [
        input.hostname,
        input.unicodeHostname,
        input.path,
        input.pageTitle ?? '',
        input.pageExcerpt ?? '',
      ].join(' \n ');
      return {
        status: 'completed',
        indicators: this.toIndicators(res.indicators, corpus, input.existing, 'url_ai', 'link'),
      };
    } catch (e) {
      return this.failure(e, 'url analysis');
    }
  }

  async analyzeJobAd(redactedText: string, existing: Indicator[]): Promise<AiResult> {
    if (!this.client) return this.notConfigured();
    const user = [
      `Red flags already found by rules: ${JSON.stringify(existing.map((i) => i.category))}`,
      'Job advert / recruiter message:',
      wrapUntrusted('job_advert', redactedText),
    ].join('\n\n');
    try {
      const res = await this.callJson(JOB_AD_INDICATORS_SYSTEM, user, AiIndicatorsSchema, 900);
      return {
        status: 'completed',
        indicators: this.toIndicators(res.indicators, redactedText, existing, 'job_ad_ai', 'offer'),
      };
    } catch (e) {
      return this.failure(e, 'job ad analysis');
    }
  }

  /** Returns null when AI is unavailable or its output is rejected; callers fall back to the template. */
  async explain(input: SummaryInput, baseActions: string[]): Promise<Explanation | null> {
    if (!this.client) return null;
    const facts = {
      overallAssessment: CATEGORY_LABELS[input.assessment.category],
      linkAssessment: CATEGORY_LABELS[input.assessment.link],
      jobOfferAssessment: input.assessment.offer
        ? OFFER_CATEGORY_LABELS[input.assessment.offer]
        : 'not analysed (no job text provided)',
      reasons: input.assessment.reasons,
      conflictsBetweenChecks: input.assessment.conflicts,
      observedFindings: input.findings,
      indicators: input.indicators.map((i) => ({
        title: i.title,
        severity: i.severity,
        evidence: i.evidence.slice(0, 160),
        source: i.source,
      })),
      notChecked: input.unknowns,
      pageInspected: input.pageInspected,
    };
    const key = createHash('sha256').update(JSON.stringify(facts)).digest('hex');
    const cached = this.summaryCache.get(key);
    if (cached) return cached;
    try {
      const res = await this.callJson(
        SUMMARY_SYSTEM,
        wrapUntrusted('findings', JSON.stringify(facts, null, 2)),
        AiSummarySchema,
        800,
      );
      const allText = [res.summary, ...res.whyItMatters, ...res.additionalActions].join(' ');
      const forbidden = [
        ...FORBIDDEN_ALWAYS,
        ...(input.pageInspected ? [] : FORBIDDEN_WITHOUT_PAGE),
      ];
      if (forbidden.some((re) => re.test(allText)) || claimsGuarantee(allText)) {
        this.logger.warn('summary rejected by safety guard');
        return null;
      }
      const actions = [...baseActions];
      for (const a of res.additionalActions.slice(0, 3)) {
        const clean = cleanText(a, 300);
        if (!actions.some((x) => norm(x) === norm(clean))) actions.push(clean);
      }
      const explanation: Explanation = {
        source: 'ai',
        summary: cleanText(res.summary, 1200),
        whyItMatters: res.whyItMatters.map((w) => cleanText(w, 400)),
        recommendedActions: actions,
      };
      this.summaryCache.set(key, explanation);
      return explanation;
    } catch (e) {
      this.failure(e, 'summary');
      return null;
    }
  }
}
