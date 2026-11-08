import { AlertTriangle, CheckCircle2, HelpCircle } from 'lucide-react';
import type { WebCheckCheck, WebCheckThreatSource } from '@radarjob/shared';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import { Panel } from '../ui/panel';
import { StatusMark } from '../status-mark';

function SourceRow({ s }: { s: WebCheckThreatSource }) {
  const { Icon, cls, label } =
    s.listed === true
      ? {
          Icon: AlertTriangle,
          cls: 'text-danger',
          label: s.historical ? 'Listed in the past' : 'Listed as harmful',
        }
      : s.listed === false
        ? { Icon: CheckCircle2, cls: 'text-signal', label: 'Not listed' }
        : { Icon: HelpCircle, cls: 'text-unknown', label: 'Could not check' };
  return (
    <li className="flex items-start justify-between gap-4 py-2 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="font-medium text-ink">{s.name}</p>
        {s.detail && <p className="text-sm text-ink-soft">{s.detail}</p>}
      </div>
      <span className={cn('inline-flex shrink-0 items-center gap-1.5 text-sm font-medium', cls)}>
        <Icon aria-hidden className="size-4" />
        <span className="text-ink">{label}</span>
      </span>
    </li>
  );
}

/** Web-Check results: threat feeds, security DNS filters, the HTTPS certificate and popularity. */
export function SiteSecurity({ check }: { check: WebCheckCheck }) {
  const { threats, blocklists, tls, rank } = check;
  return (
    <Panel
      title="Threat feeds & site security"
      description={`Phishing and malware lists, security DNS filters and the site's certificate${check.provider ? ` — source: ${check.provider}` : ''}.`}
    >
      <div className="mb-3">
        <StatusMark status={check.status} />
      </div>
      {check.status === 'completed' ? (
        <div className="space-y-5">
          {threats && (
            <section>
              <h3 className="mb-2 text-sm font-semibold text-ink-soft">
                Threat-intelligence feeds
              </h3>
              <ul className="divide-y divide-rule">
                {threats.map((s) => (
                  <SourceRow key={s.name} s={s} />
                ))}
              </ul>
            </section>
          )}
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {blocklists && (
              <div>
                <dt className="text-sm text-ink-soft">Security DNS filters</dt>
                <dd
                  className={cn(
                    'font-medium',
                    blocklists.securityBlockedBy.length ? 'text-danger' : 'text-ink',
                  )}
                >
                  {blocklists.securityBlockedBy.length
                    ? `Blocked by ${blocklists.securityBlockedBy.join(', ')}`
                    : `Not blocked by any of ${blocklists.securityChecked}`}
                </dd>
              </div>
            )}
            {tls && (
              <div>
                <dt className="text-sm text-ink-soft">HTTPS certificate</dt>
                <dd className={cn('font-medium', tls.valid ? 'text-ink' : 'text-danger')}>
                  {tls.valid
                    ? `Valid${tls.issuer ? ` (${tls.issuer})` : ''}${tls.validTo ? `, expires ${formatDate(tls.validTo)}` : ''}`
                    : `Not valid${tls.error ? ` — ${tls.error}` : ''}`}
                </dd>
              </div>
            )}
            {rank && (
              <div>
                <dt className="text-sm text-ink-soft">Popularity (Tranco)</dt>
                <dd className="font-medium text-ink">
                  {rank.position
                    ? `#${rank.position.toLocaleString('en-US')} most visited`
                    : 'Not in the top 1 million'}
                </dd>
              </div>
            )}
          </dl>
          <p className="rounded-md bg-unknown-wash px-3 py-2 text-sm text-ink">
            Not being listed means these services have not flagged the site <em>yet</em>. Popularity
            and a valid certificate show the site is real and reachable — not that a job offer on it
            is genuine.
          </p>
          {check.message && <p className="text-sm text-ink-faint">{check.message}</p>}
        </div>
      ) : (
        <p className="text-ink-soft">
          {check.message ?? 'These checks are not available.'}{' '}
          <strong className="text-ink">This is not a clean result.</strong>
        </p>
      )}
    </Panel>
  );
}
