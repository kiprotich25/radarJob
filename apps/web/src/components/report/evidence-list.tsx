import { SEVERITY_LABELS, type Indicator } from '@radarjob/shared';
import { cn } from '@/lib/cn';
import { SEVERITY_STYLE } from '../risk-style';

const SOURCE_LABELS: Record<Indicator['source'], string> = {
  virustotal: 'VirusTotal',
  domain: 'Domain registration',
  url_heuristic: 'Link structure rules',
  url_ai: 'AI-assisted link analysis',
  page: 'Page inspection',
  job_ad: 'Job text rules',
  job_ad_ai: 'AI-assisted text review',
  webcheck: 'Threat feeds & DNS filters (Web-Check)',
};

const ORDER = { strong: 0, moderate: 1, weak: 2, info: 3 } as const;

export function EvidenceList({
  indicators,
  emptyText,
}: {
  indicators: Indicator[];
  emptyText: string;
}) {
  if (!indicators.length) return <p className="text-ink-soft">{emptyText}</p>;
  const sorted = [...indicators].sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);
  return (
    <ul className="divide-y divide-rule">
      {sorted.map((i) => {
        const s = SEVERITY_STYLE[i.severity];
        return (
          <li key={i.id} className="py-4 first:pt-0 last:pb-0">
            <div className="flex items-start gap-3">
              <span aria-hidden className={cn('mt-2 size-2.5 shrink-0', s.dot, s.shape)} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink">{i.title}</p>
                <p className="mt-0.5 text-sm">
                  <span className={cn('font-semibold', s.text)}>{SEVERITY_LABELS[i.severity]}</span>
                  <span className="text-ink-faint">
                    {' '}
                    — {SOURCE_LABELS[i.source]},{' '}
                    {i.basis === 'observed' ? 'directly observed' : 'an interpretation'}
                  </span>
                </p>
                <p className="mt-2 break-words rounded-md bg-paper px-3 py-2 text-sm text-ink">
                  <span className="text-ink-soft">Evidence: </span>
                  {i.evidence}
                </p>
                <p className="mt-2 text-ink-soft">{i.whyItMatters}</p>
                {i.limitations && (
                  <p className="mt-1 text-sm text-ink-faint">Limitation: {i.limitations}</p>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
