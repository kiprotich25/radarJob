import { z } from 'zod';
import type { VirusTotalCheck, VtStats } from '@radarjob/shared';
import { ProviderError } from '../common/provider-error';

/**
 * Normalisation of VirusTotal v3 API payloads into RadarJob's internal shape.
 * Raw provider responses are never passed to the browser.
 * Docs: https://docs.virustotal.com/reference/overview
 */

const StatsSchema = z.object({
  malicious: z.number().int().nonnegative().default(0),
  suspicious: z.number().int().nonnegative().default(0),
  harmless: z.number().int().nonnegative().default(0),
  undetected: z.number().int().nonnegative().default(0),
  timeout: z.number().int().nonnegative().default(0),
});

const EngineResultSchema = z.object({
  engine_name: z.string().optional(),
  category: z.string().optional(),
  result: z.string().nullable().optional(),
});

const ResultsSchema = z.record(z.string(), EngineResultSchema).optional();

/** GET /api/v3/urls/{id} */
export const UrlObjectSchema = z.object({
  data: z.object({
    attributes: z.object({
      last_analysis_stats: StatsSchema.optional(),
      last_analysis_results: ResultsSchema,
      last_analysis_date: z.number().optional(),
    }),
  }),
});

/** POST /api/v3/urls */
export const SubmitSchema = z.object({
  data: z.object({ id: z.string().min(1), type: z.string().optional() }),
});

/** GET /api/v3/analyses/{id} */
export const AnalysisObjectSchema = z.object({
  data: z.object({
    attributes: z.object({
      status: z.string(),
      stats: StatsSchema.optional(),
      results: ResultsSchema,
      date: z.number().optional(),
    }),
  }),
});

const MAX_FLAGGED = 25;

function toIso(unixSeconds: number | undefined): string | undefined {
  if (!unixSeconds || !Number.isFinite(unixSeconds)) return undefined;
  return new Date(unixSeconds * 1000).toISOString();
}

function flagged(results: z.infer<typeof ResultsSchema>) {
  if (!results) return [];
  return Object.entries(results)
    .filter(([, r]) => r.category === 'malicious' || r.category === 'suspicious')
    .map(([key, r]) => ({
      engine: (r.engine_name ?? key).slice(0, 80),
      category: r.category as string,
      result: r.result ? r.result.slice(0, 80) : undefined,
    }))
    .sort((a, b) =>
      a.category === b.category
        ? a.engine.localeCompare(b.engine)
        : a.category === 'malicious'
          ? -1
          : 1,
    )
    .slice(0, MAX_FLAGGED);
}

function parse<T>(schema: z.ZodType<T>, payload: unknown, what: string): T {
  const r = schema.safeParse(payload);
  if (!r.success) {
    throw new ProviderError(
      'bad_response',
      'VirusTotal returned an unexpected response.',
      `malformed ${what}`,
    );
  }
  return r.data;
}

export interface NormalizedUrlReport {
  stats: VtStats;
  analysisDate?: string;
  flaggedBy: NonNullable<VirusTotalCheck['flaggedBy']>;
}

/** Returns null when VirusTotal has a URL object but no completed analysis yet. */
export function normalizeUrlObject(payload: unknown): NormalizedUrlReport | null {
  const obj = parse(UrlObjectSchema, payload, 'url object');
  const a = obj.data.attributes;
  if (!a.last_analysis_stats || !a.last_analysis_date) return null;
  return {
    stats: StatsSchema.parse(a.last_analysis_stats),
    analysisDate: toIso(a.last_analysis_date),
    flaggedBy: flagged(a.last_analysis_results),
  };
}

export function parseSubmission(payload: unknown): string {
  return parse(SubmitSchema, payload, 'submission').data.id;
}

export type NormalizedAnalysis =
  | { state: 'completed'; report: NormalizedUrlReport }
  | { state: 'pending'; providerStatus: string };

export function normalizeAnalysis(payload: unknown): NormalizedAnalysis {
  const obj = parse(AnalysisObjectSchema, payload, 'analysis');
  const a = obj.data.attributes;
  if (a.status !== 'completed') return { state: 'pending', providerStatus: a.status };
  if (!a.stats) {
    throw new ProviderError(
      'bad_response',
      'VirusTotal returned an incomplete analysis.',
      'completed without stats',
    );
  }
  return {
    state: 'completed',
    report: { stats: a.stats, analysisDate: toIso(a.date), flaggedBy: flagged(a.results) },
  };
}

/** VirusTotal URL identifier: unpadded base64url of the URL. */
export function vtUrlId(url: string): string {
  return Buffer.from(url, 'utf8').toString('base64url');
}

export function totalEngines(stats: VtStats): number {
  return stats.malicious + stats.suspicious + stats.harmless + stats.undetected + stats.timeout;
}
