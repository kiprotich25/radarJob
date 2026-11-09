/**
 * Configurable thresholds for the deterministic risk-assessment engine.
 * Change these values (and bump `version`) rather than editing engine logic.
 * There is no numerical "fraud probability": categories are driven by the
 * strength and independence of the evidence.
 */
export interface RiskRules {
  version: string;
  virustotal: {
    /** Malicious verdicts at or above this count are strong evidence. */
    strongMaliciousCount: number;
    /** Malicious verdicts at or above this count (but below strong) are moderate evidence. */
    moderateMaliciousCount: number;
    /** Suspicious-only verdicts at or above this count are weak evidence. */
    suspiciousCountForWeak: number;
  };
  domain: {
    /** Domains younger than this many days produce a moderate "new domain" red flag. */
    newDomainDays: number;
    /** Domains older than this are treated as "long established" when explaining conflicts. */
    establishedDays: number;
  };
  webcheck: {
    /** Security DNS filters blocking the domain at or above this count are moderate evidence (one is weak). */
    securityResolversForModerate: number;
  };
  /** Number of weak signals that together justify "suspicious". */
  weakSignalsForSuspicious: number;
  /**
   * Moderate signals from this many independent sources (excluding AI) justify
   * "potentially malicious" even without a single strong signal.
   */
  independentModerateSourcesForMalicious: number;
}

export const DEFAULT_RULES: RiskRules = {
  version: '2026.11-2',
  virustotal: { strongMaliciousCount: 3, moderateMaliciousCount: 1, suspiciousCountForWeak: 1 },
  domain: { newDomainDays: 30, establishedDays: 3 * 365 },
  webcheck: { securityResolversForModerate: 2 },
  weakSignalsForSuspicious: 3,
  independentModerateSourcesForMalicious: 2,
};
