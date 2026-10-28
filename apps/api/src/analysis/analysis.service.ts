import { randomUUID } from 'node:crypto';
import {
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  validateAndNormalizeUrl,
  type AnalysisReport,
  type DomainCheck,
  type Indicator,
  type NormalizedUrl,
  type VirusTotalCheck,
} from '@radarjob/shared';
import { AI_SERVICE, AiService, type AiResult } from '../ai/ai.service';
import { ApiException } from '../common/api-error';
import { Semaphore } from '../common/limiters';
import { logSafeHost, redactPersonalData } from '../common/redact';
import { ENV, type Env } from '../config/env';
import {
  DOMAIN_INTEL_PROVIDER,
  type DomainIntelProvider,
} from '../domain-intelligence/domain-intel.provider';
import { analyzeJobAdText } from '../job-ad/job-ad.rules';
import {
  PAGE_INSPECTOR,
  type PageInspectionOutcome,
  type PageInspector,
} from '../page-inspection/page-inspection.service';
import { isPublicAddress } from '../page-inspection/ssrf-guard';
import {
  buildFindings,
  buildUnknowns,
  recommendedActions,
  STANDARD_LIMITATIONS,
  templateExplanation,
} from '../report/report-content';
import { domainIndicators, virusTotalIndicators } from '../risk-assessment/evidence';
import { assessRisk } from '../risk-assessment/risk-engine';
import { DEFAULT_RULES } from '../risk-assessment/rules.config';
import { analyzeUrlStructure } from '../url-analysis/url-heuristics';
import { REPUTATION_PROVIDER, type ReputationProvider } from '../virustotal/reputation.provider';
import { REPORT_STORE, type ReportStore } from './report-store';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Resolve with the promise's value, or with `fallback()` if it takes longer than `ms`. */
function bounded<T>(p: Promise<T>, ms: number, fallback: () => T): Promise<T> {
  return new Promise<T>((resolve) => {
    const timer = setTimeout(() => resolve(fallback()), Math.max(ms, 0));
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback());
      },
    );
  });
}

/**
 * Orchestrates one link analysis:
 * validate → (reputation ∥ domain ∥ page inspection ∥ job-ad rules) → AI indicators
 * → deterministic risk assessment → AI or template explanation.
 * Progress is written to the store after each step so the UI can show it live.
 */
@Injectable()
export class AnalysisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Analysis');
  private readonly gate: Semaphore;
  private purgeTimer?: NodeJS.Timeout;

  constructor(
    @Inject(ENV) private readonly env: Env,
    @Inject(REPUTATION_PROVIDER) private readonly reputation: ReputationProvider,
    @Inject(DOMAIN_INTEL_PROVIDER) private readonly domainIntel: DomainIntelProvider,
    @Inject(PAGE_INSPECTOR) private readonly pageInspector: PageInspector,
    @Inject(AI_SERVICE) private readonly ai: AiService,
    @Inject(REPORT_STORE) private readonly store: ReportStore,
  ) {
    this.gate = new Semaphore(env.ANALYSIS_MAX_CONCURRENT, env.ANALYSIS_MAX_QUEUED);
  }

  onModuleInit() {
    this.purgeTimer = setInterval(() => {
      this.store
        .purgeExpired()
        .catch((e) => this.logger.warn(`purge failed: ${e instanceof Error ? e.message : e}`));
    }, 15 * 60_000);
    this.purgeTimer.unref();
  }

  async onModuleDestroy() {
    if (this.purgeTimer) clearInterval(this.purgeTimer);
    await this.store.close?.();
  }

  validate(rawUrl: string): NormalizedUrl {
    const result = validateAndNormalizeUrl(rawUrl);
    if (!result.ok)
      throw new ApiException(HttpStatus.BAD_REQUEST, `invalid_url.${result.code}`, result.message);
    const u = result.value;
    if (u.isIp && !isPublicAddress(u.hostname.replace(/^\[|\]$/g, ''))) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'invalid_url.local_address',
        'Local, private or internal addresses cannot be analyzed.',
      );
    }
    return u;
  }

  async start(rawUrl: string, jobAdText?: string): Promise<{ id: string; status: 'running' }> {
    const u = this.validate(rawUrl);
    const text = jobAdText?.trim() ? jobAdText.trim() : undefined;
    if (!this.gate.tryEnqueue()) {
      throw new ApiException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'busy',
        'RadarJob is handling many checks right now. Please try again in a minute.',
      );
    }
    const report = this.initialReport(u, Boolean(text));
    await this.store.save(report, u.registeredDomain);
    this.logger.log(`analysis ${report.id} started for ${logSafeHost(u.hostname)}`);
    void this.execute(report, u, text);
    return { id: report.id, status: 'running' };
  }

  async get(id: string): Promise<AnalysisReport> {
    if (!UUID_RE.test(id))
      throw new ApiException(
        HttpStatus.NOT_FOUND,
        'not_found',
        'This report does not exist or has expired.',
      );
    const report = await this.store.get(id);
    if (!report)
      throw new ApiException(
        HttpStatus.NOT_FOUND,
        'not_found',
        'This report does not exist or has expired.',
      );
    return report;
  }

  private initialReport(u: NormalizedUrl, jobAdSupplied: boolean): AnalysisReport {
    return {
      id: randomUUID(),
      status: 'running',
      createdAt: new Date().toISOString(),
      simulated: this.env.DEV_MOCK_PROVIDERS,
      input: {
        displayUrl: u.displayUrl,
        hostname: u.hostname,
        unicodeHostname: u.unicodeHostname,
        registeredDomain: u.registeredDomain,
        hadQuery: u.hasQuery,
        jobAdSupplied,
      },
      checks: {
        virustotal: { status: 'pending' },
        domain: { status: 'pending' },
        urlHeuristics: { status: 'pending' },
        urlAi: { status: 'pending' },
        page: { status: 'pending' },
        jobAd: jobAdSupplied
          ? { status: 'pending' }
          : { status: 'skipped', message: 'No job text was provided.' },
      },
      indicators: [],
      findings: [],
      unknowns: [],
      limitations: STANDARD_LIMITATIONS,
    };
  }

  /** Public for tests: runs the pipeline to completion and returns the final report. */
  async execute(
    report: AnalysisReport,
    u: NormalizedUrl,
    jobAdText?: string,
  ): Promise<AnalysisReport> {
    const release = await this.gate.acquire();
    const deadline = Date.now() + this.env.ANALYSIS_TIMEOUT_MS;
    const remaining = () => deadline - Date.now();
    let chain = Promise.resolve();
    const persist = () => {
      const snapshot = structuredClone(report);
      chain = chain
        .then(() => this.store.save(snapshot, u.registeredDomain))
        .catch((e) => {
          this.logger.warn(
            `could not persist progress for ${report.id}: ${e instanceof Error ? e.message : e}`,
          );
        });
      return chain;
    };

    try {
      const c = report.checks;
      c.virustotal = { status: 'running' };
      c.domain = { status: 'running' };
      c.page = { status: this.pageInspector.enabled ? 'running' : 'skipped' };
      c.urlAi = { status: this.ai.configured ? 'running' : 'not_configured' };

      // 1. Deterministic URL structure analysis (instant, always available).
      const structure = analyzeUrlStructure(u);
      c.urlHeuristics = { status: 'completed' };
      const jobRuleIndicators = jobAdText ? analyzeJobAdText(jobAdText) : [];
      if (jobAdText) c.jobAd = { status: 'running' };
      await persist();

      // 2. External checks in parallel, each bounded by the overall deadline.
      const timedOut = (what: string) => `${what} did not finish within the time limit.`;
      const vtP = bounded<VirusTotalCheck>(
        this.reputation.check(u.normalized),
        remaining(),
        () => ({
          status: 'unavailable',
          message: timedOut('The VirusTotal check'),
        }),
      ).then(async (r) => {
        c.virustotal = r;
        await persist();
        return r;
      });

      const domainP = (
        u.registeredDomain
          ? bounded<DomainCheck>(
              this.domainIntel.lookup(
                u.registeredDomain,
                u.unicodeHostname.split('.').slice(-u.registeredDomain.split('.').length).join('.'),
              ),
              remaining(),
              () => ({
                status: 'unavailable',
                message: timedOut('The domain lookup'),
              }),
            )
          : Promise.resolve<DomainCheck>({
              status: 'skipped',
              message:
                'The link uses an IP address, so there is no domain registration to look up.',
            })
      ).then(async (r) => {
        c.domain = r;
        await persist();
        return r;
      });

      const pageP = bounded<PageInspectionOutcome>(
        this.pageInspector.inspect(u.normalized, structure.impersonatedBrands),
        remaining(),
        () => ({
          check: {
            status: 'unavailable',
            message: `${timedOut('Page inspection')} The webpage itself was not inspected.`,
          },
          indicators: [],
        }),
      ).then(async (r) => {
        c.page = r.check;
        await persist();
        return r;
      });

      const jobAiP: Promise<AiResult | null> = jobAdText
        ? bounded(
            this.ai.analyzeJobAd(redactPersonalData(jobAdText), jobRuleIndicators),
            remaining(),
            () => ({
              status: 'unavailable' as const,
              message: 'The AI review did not finish in time.',
              indicators: [],
            }),
          )
        : Promise.resolve(null);

      // URL AI waits for page inspection so it can use the (redacted) excerpt.
      const urlAiP = pageP.then((page) =>
        bounded(
          this.ai.analyzeUrl({
            hostname: u.hostname,
            unicodeHostname: u.unicodeHostname,
            registeredDomain: u.registeredDomain,
            path: u.pathname,
            existing: [...structure.indicators, ...page.indicators],
            pageTitle: page.facts?.title,
            pageExcerpt: page.facts?.textExcerpt.slice(0, 2000),
          }),
          remaining(),
          () => ({
            status: 'unavailable' as const,
            message: 'The AI analysis did not finish in time.',
            indicators: [],
          }),
        ),
      );

      const [vt, domain, page, urlAi, jobAi] = await Promise.all([
        vtP,
        domainP,
        pageP,
        urlAiP,
        jobAiP,
      ]);
      c.urlAi = { status: urlAi.status, message: urlAi.message };
      if (jobAdText) {
        c.jobAd = {
          status: 'completed',
          message:
            jobAi && jobAi.status !== 'completed'
              ? `Rule-based checks ran. AI review: ${jobAi.message ?? jobAi.status}.`
              : undefined,
        };
      }

      // 3. Evidence → deterministic assessment.
      const all: Indicator[] = [
        ...virusTotalIndicators(vt, DEFAULT_RULES),
        ...structure.indicators,
        ...domainIndicators(domain, DEFAULT_RULES),
        ...page.indicators,
        ...urlAi.indicators,
        ...jobRuleIndicators,
        ...(jobAi?.indicators ?? []),
      ];
      const counters: Record<string, number> = {};
      report.indicators = all.map((i) => ({
        ...i,
        id: `${i.source}-${(counters[i.source] = (counters[i.source] ?? 0) + 1)}`,
      }));

      const assessment = assessRisk(
        { vt, domain, indicators: report.indicators, jobAdSupplied: Boolean(jobAdText) },
        DEFAULT_RULES,
      );
      report.assessment = assessment;
      report.findings = buildFindings(c);
      report.unknowns = buildUnknowns(c, Boolean(jobAdText));

      // 4. Explanation: AI if available and valid, otherwise the deterministic template.
      const explanation =
        (await bounded(
          this.ai.explain(
            {
              assessment,
              findings: report.findings,
              unknowns: report.unknowns,
              indicators: report.indicators,
              pageInspected: c.page.status === 'completed',
            },
            recommendedActions(assessment),
          ),
          Math.max(remaining(), 5000),
          () => null,
        )) ?? templateExplanation(assessment, c);
      report.explanation = explanation;
      report.status = 'completed';
      report.completedAt = new Date().toISOString();
      await persist();
      this.logger.log(`analysis ${report.id} completed: ${assessment.category}`);
      return report;
    } catch (e) {
      this.logger.error(
        `analysis ${report.id} failed: ${e instanceof Error ? e.message : String(e)}`,
      );
      report.status = 'failed';
      report.error =
        'The analysis could not be completed because of an internal error. No assessment was made.';
      report.completedAt = new Date().toISOString();
      await persist();
      return report;
    } finally {
      release();
    }
  }
}
