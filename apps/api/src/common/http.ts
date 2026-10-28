import { ProviderError } from './provider-error';

export interface HttpResponse {
  status: number;
  headers: Headers;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
}

/** Fetch-compatible signature so providers can be tested with a fake. */
export type FetchLike = (input: string, init?: RequestInit) => Promise<HttpResponse>;

export const defaultFetch: FetchLike = (input, init) => fetch(input, init);

/**
 * Call a trusted provider endpoint with a hard timeout.
 * Network failures and timeouts become ProviderErrors so callers never
 * mistake a failed request for an empty result.
 */
export async function fetchWithTimeout(
  fetchImpl: FetchLike,
  url: string,
  init: RequestInit,
  timeoutMs: number,
  providerName: string,
): Promise<HttpResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (controller.signal.aborted) {
      throw new ProviderError(
        'timeout',
        `${providerName} did not respond in time.`,
        `timeout after ${timeoutMs}ms`,
      );
    }
    throw new ProviderError(
      'unavailable',
      `${providerName} could not be reached.`,
      err instanceof Error ? err.message : String(err),
    );
  } finally {
    clearTimeout(timer);
  }
}

export async function readJson(res: HttpResponse, providerName: string): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    throw new ProviderError(
      'bad_response',
      `${providerName} returned an unreadable response.`,
      'invalid JSON',
    );
  }
}

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
