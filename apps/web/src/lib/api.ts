import {
  ApiErrorSchema,
  CreateAnalysisResponseSchema,
  HealthSchema,
  JobAdReportSchema,
  ReportSchema,
  type AnalysisReport,
  type CreateAnalysisResponse,
  type Health,
  type JobAdReport,
} from '@radarjob/shared';
import type { z } from 'zod';

export type ApiErrorKind = 'offline' | 'network' | 'http' | 'invalid_response';

export class ApiClientError extends Error {
  constructor(
    readonly kind: ApiErrorKind,
    message: string,
    readonly status?: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

export const OFFLINE_MESSAGE = "You're offline. Connect to the internet to verify this job link.";
export const NETWORK_MESSAGE =
  "Verification could not be completed because RadarJob's server could not be reached. Check your connection and try again.";

function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

/**
 * Call the RadarJob API. `navigator.onLine` is only a first hint: real request
 * failures are mapped separately so an unreachable server is never mistaken for a result.
 */
async function call<S extends z.ZodType>(
  path: string,
  schema: S,
  init?: RequestInit,
): Promise<z.infer<S>> {
  if (isOffline()) throw new ApiClientError('offline', OFFLINE_MESSAGE);
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      cache: 'no-store',
      headers: {
        accept: 'application/json',
        ...(init?.body ? { 'content-type': 'application/json' } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiClientError(
      isOffline() ? 'offline' : 'network',
      isOffline() ? OFFLINE_MESSAGE : NETWORK_MESSAGE,
    );
  }
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    body = undefined;
  }
  if (!res.ok) {
    const parsed = ApiErrorSchema.safeParse(body);
    if (parsed.success)
      throw new ApiClientError(
        'http',
        parsed.data.error.message,
        res.status,
        parsed.data.error.code,
      );
    // A proxy error page (e.g. backend down behind Next.js) has no JSON body.
    if (res.status >= 500) throw new ApiClientError('network', NETWORK_MESSAGE, res.status);
    throw new ApiClientError('http', 'The request could not be completed.', res.status);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ApiClientError(
      'invalid_response',
      'RadarJob received an unexpected response from its server. No result can be shown.',
    );
  }
  return parsed.data;
}

export const api = {
  startAnalysis(url: string, jobAdText?: string): Promise<CreateAnalysisResponse> {
    return call('/api/analysis', CreateAnalysisResponseSchema, {
      method: 'POST',
      body: JSON.stringify(jobAdText?.trim() ? { url, jobAdText } : { url }),
    });
  },
  getReport(id: string): Promise<AnalysisReport> {
    return call(`/api/analysis/${encodeURIComponent(id)}`, ReportSchema);
  },
  analyzeJobAd(text: string): Promise<JobAdReport> {
    return call('/api/job-ad-analysis', JobAdReportSchema, {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
  },
  health(): Promise<Health> {
    return call('/api/health', HealthSchema);
  },
};
