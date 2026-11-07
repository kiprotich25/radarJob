import {
  CircleHelp,
  OctagonAlert,
  ShieldCheck,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import type { RiskCategory, Severity } from '@radarjob/shared';

/** Risk is always shown as icon shape + text label + colour, never colour alone. */
export const RISK_STYLE: Record<
  RiskCategory,
  { icon: LucideIcon; text: string; wash: string; border: string }
> = {
  potentially_malicious: {
    icon: OctagonAlert,
    text: 'text-danger',
    wash: 'bg-danger-wash',
    border: 'border-danger',
  },
  suspicious: {
    icon: TriangleAlert,
    text: 'text-caution',
    wash: 'bg-caution-wash',
    border: 'border-caution',
  },
  no_significant_threats: {
    icon: ShieldCheck,
    text: 'text-positive',
    wash: 'bg-positive-wash',
    border: 'border-positive',
  },
  inconclusive: {
    icon: CircleHelp,
    text: 'text-unknown',
    wash: 'bg-unknown-wash',
    border: 'border-unknown',
  },
};

export const SEVERITY_STYLE: Record<Severity, { dot: string; text: string; shape: string }> = {
  strong: { dot: 'bg-danger', text: 'text-danger', shape: 'rounded-none rotate-45' },
  moderate: { dot: 'bg-caution', text: 'text-caution', shape: 'rounded-[1px]' },
  weak: { dot: 'bg-ink-faint', text: 'text-ink-soft', shape: 'rounded-full' },
  info: { dot: 'bg-rule-strong', text: 'text-ink-faint', shape: 'rounded-full' },
};
