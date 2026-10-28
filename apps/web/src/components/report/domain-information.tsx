import type { DomainCheck } from '@radarjob/shared';
import { describeAge, formatDate } from '@/lib/format';
import { Panel } from '../ui/panel';
import { StatusMark } from '../status-mark';

export function DomainInformation({ domain }: { domain: DomainCheck }) {
  const d = domain.data;
  return (
    <Panel
      title="Domain registration"
      description={
        domain.provider
          ? `Source: ${domain.provider}`
          : 'Who registered the website address, and when.'
      }
    >
      <div className="mb-3">
        <StatusMark status={domain.status} />
      </div>
      {domain.status === 'completed' && d ? (
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {[
            [
              'Domain',
              d.unicodeDomain !== d.domain ? `${d.unicodeDomain} (${d.domain})` : d.domain,
            ],
            ['Age', describeAge(d.ageDays)],
            ['Registered', formatDate(d.createdAt)],
            ['Last updated', formatDate(d.updatedAt)],
            ['Expires', formatDate(d.expiresAt)],
            ['Registrar', d.registrar ?? 'Not published'],
            [
              'Owner details',
              d.redacted
                ? 'Privacy-protected (common and not a warning sign by itself)'
                : 'Not marked as redacted',
            ],
            ['Name servers', d.nameservers.length ? d.nameservers.join(', ') : 'Not published'],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-sm text-ink-soft">{k}</dt>
              <dd className="break-words font-medium text-ink">{v}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-ink-soft">
          {domain.message ?? 'Registration data is not available.'} Missing registration data does
          not make a link more or less risky.
        </p>
      )}
    </Panel>
  );
}
