import type { VirusTotalCheck } from '@radarjob/shared';

export type IntegrationMode = 'configured' | 'not_configured' | 'mock';

/** URL reputation provider. Implementations must never throw — failures are reported in the status. */
export interface ReputationProvider {
  readonly mode: IntegrationMode;
  check(normalizedUrl: string): Promise<VirusTotalCheck>;
}

export const REPUTATION_PROVIDER = Symbol('REPUTATION_PROVIDER');
