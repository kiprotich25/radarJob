import { DynamicModule, Module, type Provider } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaPg } from '@prisma/adapter-pg';
import { AI_SERVICE, AiService } from './ai/ai.service';
import {
  AnthropicClient,
  MockLlmClient,
  OpenAiCompatibleClient,
  type LlmClient,
} from './ai/llm-client';
import { AnalysisController } from './analysis/analysis.controller';
import { AnalysisService } from './analysis/analysis.service';
import {
  InMemoryReportStore,
  PrismaReportStore,
  REPORT_STORE,
  type PrismaLike,
  type ReportStore,
} from './analysis/report-store';
import { defaultFetch, type FetchLike } from './common/http';
import { MockDomainIntelProvider, MockReputationProvider } from './common/mock-providers';
import { DEFAULT_MODELS, ENV, type Env } from './config/env';
import {
  DOMAIN_INTEL_PROVIDER,
  NoDomainIntelProvider,
  type DomainIntelProvider,
} from './domain-intelligence/domain-intel.provider';
import { RdapProvider } from './domain-intelligence/rdap.provider';
import { WhoisXmlProvider } from './domain-intelligence/whoisxml.provider';
import { EducationController } from './education/education.controller';
import { HealthController } from './health/health.controller';
import { JobAdController } from './job-ad/job-ad.controller';
import { JobAdService } from './job-ad/job-ad.service';
import {
  DisabledPageInspector,
  PAGE_INSPECTOR,
  SafePageInspector,
  type PageInspector,
} from './page-inspection/page-inspection.service';
import { systemResolver, type Resolver } from './page-inspection/ssrf-guard';
import { REPUTATION_PROVIDER, type ReputationProvider } from './virustotal/reputation.provider';
import { VirusTotalService } from './virustotal/virustotal.service';

/** Optional replacements used by tests (fake HTTP, fake DNS, fake providers). */
export interface AppOverrides {
  fetch?: FetchLike;
  resolver?: Resolver;
  reputation?: ReputationProvider;
  domainIntel?: DomainIntelProvider;
  pageInspector?: PageInspector;
  ai?: AiService;
  store?: ReportStore;
}

export function buildReputation(env: Env, fetchImpl: FetchLike): ReputationProvider {
  if (env.DEV_MOCK_PROVIDERS && !env.VIRUSTOTAL_API_KEY) return new MockReputationProvider();
  return new VirusTotalService({
    apiKey: env.VIRUSTOTAL_API_KEY,
    requestsPerMinute: env.VIRUSTOTAL_REQUESTS_PER_MINUTE,
    maxReportAgeDays: env.VIRUSTOTAL_MAX_REPORT_AGE_DAYS,
    pollAttempts: env.VIRUSTOTAL_POLL_ATTEMPTS,
    pollIntervalMs: env.VIRUSTOTAL_POLL_INTERVAL_MS,
    cacheTtlMs: env.VIRUSTOTAL_CACHE_TTL_MINUTES * 60_000,
    timeoutMs: env.VIRUSTOTAL_TIMEOUT_MS,
    fetchImpl,
  });
}

export function buildDomainIntel(env: Env, fetchImpl: FetchLike): DomainIntelProvider {
  if (env.DEV_MOCK_PROVIDERS) return new MockDomainIntelProvider();
  if (env.DOMAIN_INTELLIGENCE_PROVIDER === 'whoisxml' && env.DOMAIN_INTELLIGENCE_API_KEY) {
    return new WhoisXmlProvider(
      env.DOMAIN_INTELLIGENCE_API_KEY,
      fetchImpl,
      env.DOMAIN_INTELLIGENCE_TIMEOUT_MS,
    );
  }
  if (env.DOMAIN_INTELLIGENCE_PROVIDER === 'rdap')
    return new RdapProvider(fetchImpl, env.DOMAIN_INTELLIGENCE_TIMEOUT_MS);
  return new NoDomainIntelProvider();
}

export function buildAi(env: Env, fetchImpl: FetchLike): AiService {
  let client: LlmClient | null = null;
  // `||` because .env.example leaves AI_MODEL blank, which arrives as an empty string.
  const model =
    env.AI_MODEL || (env.AI_PROVIDER !== 'none' ? DEFAULT_MODELS[env.AI_PROVIDER] : undefined);
  if (env.AI_PROVIDER === 'anthropic' && env.ANTHROPIC_API_KEY && model) {
    client = new AnthropicClient(env.ANTHROPIC_API_KEY, model, fetchImpl, env.AI_TIMEOUT_MS);
    return new AiService(client, 'configured', `Anthropic (${model})`);
  }
  if (env.AI_PROVIDER === 'openai' && env.OPENAI_API_KEY && model) {
    client = new OpenAiCompatibleClient(
      env.OPENAI_API_KEY,
      model,
      env.OPENAI_BASE_URL,
      fetchImpl,
      env.AI_TIMEOUT_MS,
    );
    return new AiService(client, 'configured', `OpenAI-compatible (${model})`);
  }
  if (env.AI_PROVIDER === 'gemini' && env.GEMINI_API_KEY && model) {
    // Gemini 3 thinking cannot be disabled, so keep it low and leave room for the JSON answer.
    client = new OpenAiCompatibleClient(
      env.GEMINI_API_KEY,
      model,
      'https://generativelanguage.googleapis.com/v1beta/openai',
      fetchImpl,
      env.AI_TIMEOUT_MS,
      { reasoningEffort: 'low', extraMaxTokens: 2048 },
    );
    return new AiService(client, 'configured', `Gemini (${model})`);
  }
  if (env.DEV_MOCK_PROVIDERS)
    return new AiService(new MockLlmClient(), 'mock', 'Mock AI (development only)');
  return new AiService(
    null,
    'not_configured',
    env.AI_PROVIDER === 'none' ? 'None' : `${env.AI_PROVIDER} (missing key or model)`,
  );
}

export function buildPageInspector(env: Env, resolver: Resolver): PageInspector {
  if (!env.PAGE_INSPECTION_ENABLED) return new DisabledPageInspector();
  return new SafePageInspector({
    timeoutMs: env.PAGE_INSPECTION_TIMEOUT_MS,
    maxBytes: env.PAGE_INSPECTION_MAX_BYTES,
    maxRedirects: env.PAGE_INSPECTION_MAX_REDIRECTS,
    resolver,
  });
}

export async function buildStore(env: Env): Promise<ReportStore> {
  const retentionMs = env.REPORT_RETENTION_HOURS * 3600_000;
  if (!env.DATABASE_URL) return new InMemoryReportStore(retentionMs);
  // Loaded lazily so the API runs without a generated client when no database is configured.
  const { PrismaClient } = await import('./generated/prisma/client');
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
  });
  return new PrismaReportStore(prisma as unknown as PrismaLike, retentionMs);
}

@Module({})
export class AppModule {
  static register(env: Env, overrides: AppOverrides = {}): DynamicModule {
    const fetchImpl = overrides.fetch ?? defaultFetch;
    const providers: Provider[] = [
      { provide: ENV, useValue: env },
      {
        provide: REPUTATION_PROVIDER,
        useValue: overrides.reputation ?? buildReputation(env, fetchImpl),
      },
      {
        provide: DOMAIN_INTEL_PROVIDER,
        useValue: overrides.domainIntel ?? buildDomainIntel(env, fetchImpl),
      },
      { provide: AI_SERVICE, useValue: overrides.ai ?? buildAi(env, fetchImpl) },
      {
        provide: PAGE_INSPECTOR,
        useValue:
          overrides.pageInspector ?? buildPageInspector(env, overrides.resolver ?? systemResolver),
      },
      { provide: REPORT_STORE, useFactory: () => overrides.store ?? buildStore(env) },
      { provide: APP_GUARD, useClass: ThrottlerGuard },
      AnalysisService,
      JobAdService,
    ];
    return {
      module: AppModule,
      imports: [
        ThrottlerModule.forRoot({
          throttlers: [
            { name: 'default', ttl: 60_000, limit: 120 },
            { name: 'analysis', ttl: 3_600_000, limit: env.ANALYSIS_RATE_LIMIT_PER_HOUR },
          ],
        }),
      ],
      controllers: [HealthController, AnalysisController, JobAdController, EducationController],
      providers,
    };
  }
}
