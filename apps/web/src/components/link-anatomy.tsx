'use client';

import { validateAndNormalizeUrl } from '@radarjob/shared';
import { cn } from '@/lib/cn';

const EXAMPLE = 'https://safaricom.jobs-portal-ke.example/apply/login';

/**
 * Splits a link into the parts people misread. Pure parsing in the browser —
 * nothing is fetched or sent anywhere, and no verdict is given here.
 */
export function LinkAnatomy({ value, className }: { value: string; className?: string }) {
  const isExample = !value.trim();
  const parsed = validateAndNormalizeUrl(isExample ? EXAMPLE : value);
  if (!parsed.ok) return null;
  const u = parsed.value;
  const host = u.unicodeHostname;
  const reg =
    u.registeredDomain && u.hostname.endsWith(u.registeredDomain)
      ? host.slice(host.length - u.registeredDomain.length)
      : host;
  const sub = host.length > reg.length ? host.slice(0, host.length - reg.length) : '';
  const path =
    u.pathname === '/' ? '' : u.pathname.length > 40 ? `${u.pathname.slice(0, 38)}…` : u.pathname;

  return (
    <figure
      className={cn(
        'min-w-0 rounded-[var(--radius-panel)] border border-rule bg-surface p-4 sm:p-5',
        className,
      )}
    >
      <figcaption className="text-sm text-ink-soft">
        {isExample ? 'How to read a link (fictional example)' : 'How RadarJob reads your link'}
      </figcaption>
      <p
        className="mt-3 overflow-x-auto pb-1 font-semibold text-[1.05rem] whitespace-nowrap sm:text-lg"
        aria-label={`Link: ${u.displayUrl}`}
      >
        <span className="text-ink-faint">{u.protocol}//</span>
        {sub && <span className="rounded bg-caution-wash px-0.5 text-caution">{sub}</span>}
        <span className="rounded bg-signal-wash px-0.5 text-signal-ink underline decoration-signal decoration-2 underline-offset-4">
          {reg}
        </span>
        <span className="text-ink-faint">{path}</span>
      </p>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div className="border-l-4 border-signal pl-3">
          <dt className="font-semibold text-ink">Who controls the site</dt>
          <dd className="text-ink-soft">
            <span className="font-medium text-ink">
              {u.isIp ? 'An IP address — no domain name' : reg}
            </span>
            . Read the address from the first single slash, right to left.
          </dd>
        </div>
        <div className="border-l-4 border-caution pl-3">
          <dt className="font-semibold text-ink">Chosen freely by the owner</dt>
          <dd className="text-ink-soft">
            {sub ? (
              <>
                <span className="font-medium text-ink">{sub.replace(/\.$/, '')}</span> can say
                anything — including a real company&apos;s name.
              </>
            ) : (
              'There is no subdomain in this link.'
            )}
          </dd>
        </div>
      </dl>
      {u.hasQuery && (
        <p className="mt-3 text-sm text-ink-faint">
          The part after “?” is not stored or shown by RadarJob.
        </p>
      )}
    </figure>
  );
}
