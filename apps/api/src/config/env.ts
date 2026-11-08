import { z } from 'zod';

const bool = (def: boolean) =>
  z
    .enum(['true', 'false', '1', '0', ''])
    .optional()
    .transform((v) => (v === undefined || v === '' ? def : v === 'true' || v === '1'));

const int = (def: number, min: number, max: number) =>
  z.coerce.number().int().min(min).max(max).default(def);

const optionalSecret = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() && !v.startsWith('replace-with') ? v.trim() : undefined));

export const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    API_PORT: int(4000, 1, 65535),
    API_HOST: z.string().default('0.0.0.0'),
    FRONTEND_URL: z.string().default('http://localhost:3000'),
    /** Express "trust proxy" setting. "loopback" trusts X-Forwarded-For only from the local Next.js server. */
    TRUST_PROXY: z.string().default('loopback'),
    LOG_FORMAT: z.enum(['json', 'pretty']).default('pretty'),

    DATABASE_URL: z
      .string()
      .optional()
      .transform((v) => (v && v.trim() ? v.trim() : undefined)),
    REPORT_RETENTION_HOURS: int(72, 1, 24 * 90),

    VIRUSTOTAL_API_KEY: optionalSecret,
    VIRUSTOTAL_REQUESTS_PER_MINUTE: int(4, 1, 1000),
    VIRUSTOTAL_MAX_REPORT_AGE_DAYS: int(7, 0, 365),
    VIRUSTOTAL_POLL_ATTEMPTS: int(3, 0, 10),
    VIRUSTOTAL_POLL_INTERVAL_MS: int(15000, 500, 60000),
    VIRUSTOTAL_CACHE_TTL_MINUTES: int(60, 0, 24 * 60),
    VIRUSTOTAL_TIMEOUT_MS: int(15000, 1000, 60000),

    DOMAIN_INTELLIGENCE_PROVIDER: z.enum(['rdap', 'whoisxml', 'none']).default('rdap'),
    DOMAIN_INTELLIGENCE_API_KEY: optionalSecret,
    DOMAIN_INTELLIGENCE_TIMEOUT_MS: int(10000, 1000, 60000),

    AI_PROVIDER: z.enum(['anthropic', 'openai', 'gemini', 'none']).default('none'),
    AI_MODEL: z.string().optional(),
    ANTHROPIC_API_KEY: optionalSecret,
    OPENAI_API_KEY: optionalSecret,
    OPENAI_BASE_URL: z.string().default('https://api.openai.com/v1'),
    GEMINI_API_KEY: optionalSecret,
    AI_TIMEOUT_MS: int(20000, 1000, 120000),

    PAGE_INSPECTION_ENABLED: bool(false),
    PAGE_INSPECTION_TIMEOUT_MS: int(8000, 1000, 30000),
    PAGE_INSPECTION_MAX_BYTES: int(1_000_000, 10_000, 5_000_000),
    PAGE_INSPECTION_MAX_REDIRECTS: int(5, 0, 10),

    /**
     * Web-Check (https://github.com/Lissy93/web-check): threat feeds, security DNS block lists,
     * TLS certificate and popularity rank. The public web-check.xyz instance is heavily
     * rate-limited, so point WEBCHECK_API_URL at a self-hosted instance for real use.
     */
    WEBCHECK_ENABLED: bool(false),
    WEBCHECK_API_URL: z
      .string()
      .url()
      .default('https://web-check.xyz')
      .transform((v) => v.replace(/\/+$/, '').replace(/\/api$/, '')),
    WEBCHECK_TIMEOUT_MS: int(20000, 1000, 60000),
    WEBCHECK_CACHE_TTL_MINUTES: int(60, 0, 24 * 60),

    ANALYSIS_RATE_LIMIT_PER_HOUR: int(20, 1, 10000),
    ANALYSIS_MAX_CONCURRENT: int(4, 1, 100),
    ANALYSIS_MAX_QUEUED: int(20, 0, 1000),
    ANALYSIS_TIMEOUT_MS: int(120000, 10000, 600000),

    /** Development only: deterministic fake providers, clearly labelled as simulated. */
    DEV_MOCK_PROVIDERS: bool(false),
  })
  .superRefine((env, ctx) => {
    if (env.DEV_MOCK_PROVIDERS && env.NODE_ENV === 'production') {
      ctx.addIssue({
        code: 'custom',
        path: ['DEV_MOCK_PROVIDERS'],
        message: 'Mock providers must never be enabled in production.',
      });
    }
    if (
      env.DOMAIN_INTELLIGENCE_PROVIDER === 'whoisxml' &&
      !env.DOMAIN_INTELLIGENCE_API_KEY &&
      !env.DEV_MOCK_PROVIDERS
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['DOMAIN_INTELLIGENCE_API_KEY'],
        message: 'DOMAIN_INTELLIGENCE_PROVIDER=whoisxml requires DOMAIN_INTELLIGENCE_API_KEY.',
      });
    }
    if (env.NODE_ENV === 'production' && env.FRONTEND_URL.includes('*')) {
      ctx.addIssue({
        code: 'custom',
        path: ['FRONTEND_URL'],
        message: 'Wildcard origins are not allowed.',
      });
    }
  });

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}

export const ENV = Symbol('ENV');

/** Default model per provider. OpenAI-compatible providers must set AI_MODEL explicitly. */
export const DEFAULT_MODELS: Record<'anthropic' | 'openai' | 'gemini', string | undefined> = {
  anthropic: 'claude-haiku-5-5',
  openai: undefined,
  gemini: 'gemini-3.5-flash-lite',
};
