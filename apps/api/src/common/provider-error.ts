/**
 * Errors raised by external providers (VirusTotal, domain intelligence, AI).
 * `userMessage` is safe to show to end users; `detail` is for logs only and
 * must never contain secrets.
 */
export type ProviderErrorKind =
  | 'not_configured'
  | 'auth'
  | 'rate_limited'
  | 'timeout'
  | 'unavailable'
  | 'not_found'
  | 'bad_response'
  | 'blocked';

export class ProviderError extends Error {
  constructor(
    readonly kind: ProviderErrorKind,
    readonly userMessage: string,
    readonly detail?: string,
  ) {
    super(`${kind}: ${detail ?? userMessage}`);
    this.name = 'ProviderError';
  }
}

export function isProviderError(e: unknown): e is ProviderError {
  return e instanceof ProviderError;
}

/** Map an HTTP status from a provider to a ProviderError kind. */
export function kindForStatus(status: number): ProviderErrorKind {
  if (status === 401 || status === 403) return 'auth';
  if (status === 404) return 'not_found';
  if (status === 429) return 'rate_limited';
  if (status >= 500) return 'unavailable';
  return 'bad_response';
}
