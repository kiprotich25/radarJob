import type { VirusTotalCheck } from '@radarjob/shared';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/cn';
import { Panel } from '../ui/panel';
import { StatusMark } from '../status-mark';

const ROWS = [
  { key: 'malicious', label: 'Malicious', cls: 'text-danger' },
  { key: 'suspicious', label: 'Suspicious', cls: 'text-caution' },
  { key: 'harmless', label: 'Harmless', cls: 'text-ink' },
  { key: 'undetected', label: 'No verdict', cls: 'text-ink' },
] as const;

export function DetectionSummary({ vt }: { vt: VirusTotalCheck }) {
  const stats = vt.stats;
  const total = stats
    ? stats.malicious + stats.suspicious + stats.harmless + stats.undetected + stats.timeout
    : 0;
  return (
    <Panel title="URL reputation" description="Security-vendor verdicts collected by VirusTotal.">
      <div className="mb-3">
        <StatusMark status={vt.status} />
      </div>
      {vt.status === 'completed' && stats ? (
        <>
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-rule bg-rule sm:grid-cols-4">
            {ROWS.map((r) => (
              <div key={r.key} className="bg-surface p-3">
                <dt className="text-sm text-ink-soft">{r.label}</dt>
                <dd
                  className={cn(
                    'tabular text-2xl font-bold',
                    stats[r.key] > 0 ? r.cls : 'text-ink',
                  )}
                >
                  {stats[r.key]}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-sm text-ink-soft">
            {total} vendors reported. Analysis from {formatDateTime(vt.analysisDate)} (
            {vt.origin === 'new_scan'
              ? 'new scan requested by RadarJob'
              : 'most recent existing VirusTotal report'}
            ).
          </p>
          {stats.malicious === 0 && stats.suspicious === 0 && (
            <p className="mt-2 rounded-md bg-unknown-wash px-3 py-2 text-sm text-ink">
              Zero detections means no vendor has flagged this link <em>yet</em>. New scam sites are
              often unflagged, so this is not proof that the link is safe.
            </p>
          )}
          {vt.flaggedBy && vt.flaggedBy.length > 0 && (
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer font-medium text-signal">
                Vendors that flagged this link ({vt.flaggedBy.length})
              </summary>
              <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                {vt.flaggedBy.map((f) => (
                  <li key={f.engine} className="text-ink-soft">
                    <span className="font-medium text-ink">{f.engine}</span>: {f.category}
                    {f.result ? ` (${f.result})` : ''}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      ) : (
        <p className="text-ink-soft">
          {vt.message ?? 'No reputation result is available.'}{' '}
          <strong className="text-ink">This is not a clean result.</strong>
        </p>
      )}
      {vt.message && vt.status === 'completed' && (
        <p className="mt-2 text-sm text-ink-faint">{vt.message}</p>
      )}
    </Panel>
  );
}
