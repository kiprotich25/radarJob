import type { DomainCheck } from '@radarjob/shared';
import type { IntegrationMode } from '../virustotal/reputation.provider';

/** Domain-registration intelligence. Implementations must never throw. */
export interface DomainIntelProvider {
  readonly mode: IntegrationMode;
  readonly providerName: string;
  lookup(domain: string, unicodeDomain: string): Promise<DomainCheck>;
}

export const DOMAIN_INTEL_PROVIDER = Symbol('DOMAIN_INTEL_PROVIDER');

/** Whole days between `createdAt` and `now`, or undefined if the date is missing, invalid or in the future. */
export function domainAgeDays(
  createdAt: string | undefined,
  now: number = Date.now(),
): number | undefined {
  if (!createdAt) return undefined;
  const t = Date.parse(createdAt);
  if (!Number.isFinite(t) || t > now + 86_400_000) return undefined;
  return Math.max(0, Math.floor((now - t) / 86_400_000));
}

export function toIsoDate(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const t = Date.parse(value.trim());
  return Number.isFinite(t) ? new Date(t).toISOString() : undefined;
}

export class NoDomainIntelProvider implements DomainIntelProvider {
  readonly mode = 'not_configured' as const;
  readonly providerName = 'None';
  async lookup(): Promise<DomainCheck> {
    return {
      status: 'not_configured',
      message:
        'No domain-registration provider is configured, so registration data was not checked.',
    };
  }
}
