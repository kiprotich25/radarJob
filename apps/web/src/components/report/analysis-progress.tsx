import type { AnalysisReport } from '@radarjob/shared';
import { StatusMark } from '../status-mark';
import { Panel } from '../ui/panel';

export const CHECK_LABELS: Record<keyof AnalysisReport['checks'], string> = {
  urlHeuristics: 'Link structure (impersonation, look-alike names)',
  virustotal: 'URL reputation (VirusTotal)',
  domain: 'Domain registration',
  webCheck: 'Threat feeds, DNS filters & certificate',
  page: 'Webpage content',
  urlAi: 'AI-assisted link analysis',
  jobAd: 'Job text red flags',
};

const ORDER: Array<keyof AnalysisReport['checks']> = [
  'urlHeuristics',
  'virustotal',
  'domain',
  'webCheck',
  'urlAi',
  'jobAd',
];

/** Live (or final) state of each check, including the ones that failed or never ran. */
export function AnalysisProgress({
  report,
  title = 'Checks',
}: {
  report: AnalysisReport;
  title?: string;
}) {
  const running = report.status === 'running';
  return (
    <Panel
      title={title}
      description={
        running
          ? 'Some checks can take up to a minute while VirusTotal finishes scanning.'
          : 'Which checks ran, and which could not.'
      }
    >
      <ul aria-live="polite" className="divide-y divide-rule">
        {ORDER.map((k) => {
          const c = report.checks[k];
          // Older saved reports predate some checks; hide checks the server has turned off.
          if (!c || (k === 'webCheck' && c.status === 'not_configured')) return null;
          return (
            <li
              key={k}
              className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-6"
            >
              <div className="min-w-0">
                <p className="font-medium text-ink">{CHECK_LABELS[k]}</p>
                {c.message && !running && (
                  <p className="mt-0.5 text-sm text-ink-soft">{c.message}</p>
                )}
              </div>
              <StatusMark status={c.status} className="shrink-0" />
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
