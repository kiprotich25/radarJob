import {
  CATEGORY_DESCRIPTIONS,
  CATEGORY_LABELS,
  OFFER_CATEGORY_LABELS,
  type Assessment,
} from '@radarjob/shared';
import { cn } from '@/lib/cn';
import { RISK_STYLE } from '../risk-style';

export function RiskAssessmentBanner({
  assessment,
  domain,
}: {
  assessment: Assessment;
  domain: string;
}) {
  const s = RISK_STYLE[assessment.category];
  const Icon = s.icon;
  const showSplit = assessment.offer !== null;
  return (
    <section
      aria-labelledby="verdict"
      className={cn('overflow-hidden rounded-[var(--radius-panel)] border-2 bg-surface', s.border)}
    >
      <div className={cn('flex items-start gap-4 p-5 sm:p-6', s.wash)}>
        <Icon
          aria-hidden
          className={cn('mt-0.5 size-9 shrink-0 sm:size-10', s.text)}
          strokeWidth={2.2}
        />
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink-soft">
            Overall assessment for{' '}
            <span className="break-all font-semibold text-ink">{domain}</span>
          </p>
          <h2
            id="verdict"
            className={cn('mt-0.5 text-2xl font-extrabold leading-tight sm:text-[1.75rem]', s.text)}
          >
            {CATEGORY_LABELS[assessment.category]}
          </h2>
          <p className="mt-2 max-w-[62ch] text-ink">{CATEGORY_DESCRIPTIONS[assessment.category]}</p>
        </div>
      </div>
      {showSplit && (
        <dl className="grid border-t border-rule sm:grid-cols-2">
          <div className="border-b border-rule p-4 sm:border-r sm:border-b-0 sm:px-6">
            <dt className="text-sm text-ink-soft">The link (technical checks)</dt>
            <dd className={cn('font-semibold', RISK_STYLE[assessment.link].text)}>
              {CATEGORY_LABELS[assessment.link]}
            </dd>
          </div>
          <div className="p-4 sm:px-6">
            <dt className="text-sm text-ink-soft">The job offer (text you provided)</dt>
            <dd className={cn('font-semibold', RISK_STYLE[assessment.offer!].text)}>
              {OFFER_CATEGORY_LABELS[assessment.offer!]}
            </dd>
          </div>
        </dl>
      )}
    </section>
  );
}
