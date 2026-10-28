'use client';

import { Trash2, ScanSearch, FileClock } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { CATEGORY_LABELS } from '@radarjob/shared';
import {
  clearHistory,
  deleteEntry,
  getSavedReport,
  loadHistory,
  type HistoryEntry,
} from '@/lib/history';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/cn';
import { Button, buttonVariants } from './ui/button';
import { EmptyState } from './states';
import { RISK_STYLE } from './risk-style';
import { HistoricalNotice, ReportBody, SimulatedNotice } from './report/report-body';

let cache: { raw: string | null; entries: HistoryEntry[] } = { raw: null, entries: [] };

function snapshot(): HistoryEntry[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem('radarjob.history.v1');
  } catch {
    raw = null;
  }
  if (raw !== cache.raw) cache = { raw, entries: loadHistory() };
  return cache.entries;
}
const EMPTY: HistoryEntry[] = [];
function subscribe(cb: () => void) {
  window.addEventListener('radarjob-history', cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener('radarjob-history', cb);
    window.removeEventListener('storage', cb);
  };
}

/** Saved reports on this device. Opening one always shows it as historical, never as a fresh scan. */
export function HistoryList() {
  const entries = useSyncExternalStore(subscribe, snapshot, () => EMPTY);
  const params = useSearchParams();
  const router = useRouter();
  const openId = params.get('report');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  if (!hydrated) return null;

  if (openId) {
    const entry = entries.find((e) => e.id === openId);
    const report = entry ? getSavedReport(entry) : null;
    return (
      <div className="space-y-5">
        <Link href="/history" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
          Back to saved checks
        </Link>
        {entry && report ? (
          <>
            <HistoricalNotice analyzedAt={entry.analyzedAt} />
            {report.simulated && <SimulatedNotice />}
            <ReportBody report={report} />
          </>
        ) : entry ? (
          <EmptyState
            title="The saved information is incomplete"
            message={`Only a summary of this check was saved (${entry.domain}, ${formatDateTime(entry.analyzedAt)}). The full report is no longer available on this device.`}
          />
        ) : (
          <EmptyState
            title="Saved report not found"
            message="It may have been deleted from this device."
          />
        )}
      </div>
    );
  }

  if (!entries.length) {
    return (
      <EmptyState
        title="No saved checks yet"
        message="Completed link checks are saved on this device so you can look back at them, even offline."
        action={
          <Link href="/analyze" className={buttonVariants()}>
            <ScanSearch /> Check a job link
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-ink-soft">
          {entries.length} saved check{entries.length === 1 ? '' : 's'}, newest first. Stored only
          in this browser.
        </p>
        <Button variant="danger" size="sm" onClick={() => dialogRef.current?.showModal()}>
          <Trash2 /> Clear all
        </Button>
      </div>
      <ul className="divide-y divide-rule overflow-hidden rounded-[var(--radius-panel)] border border-rule bg-surface">
        {entries.map((e) => {
          const s = RISK_STYLE[e.category];
          return (
            <li key={e.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:gap-4">
              <s.icon aria-hidden className={cn('size-6 shrink-0', s.text)} />
              <div className="min-w-0 flex-1">
                <p className="break-all font-semibold text-ink">{e.domain}</p>
                <p className={cn('text-sm font-semibold', s.text)}>
                  {CATEGORY_LABELS[e.category]}
                  {e.simulated ? ' (simulated)' : ''}
                </p>
                <p className="text-sm text-ink-faint">Analysed {formatDateTime(e.analyzedAt)}</p>
                {e.summary && (
                  <p className="mt-1 line-clamp-2 text-sm text-ink-soft">{e.summary}</p>
                )}
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => router.push(`/history?report=${encodeURIComponent(e.id)}`)}
                >
                  <FileClock /> Open saved copy
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => deleteEntry(e.id)}
                  aria-label={`Delete saved check for ${e.domain}`}
                >
                  <Trash2 />
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      <dialog
        ref={dialogRef}
        aria-labelledby="clear-title"
        className="m-auto max-w-sm rounded-[var(--radius-panel)] border border-rule p-6 backdrop:bg-ink/40"
      >
        <h2 id="clear-title" className="text-lg font-bold text-ink">
          Clear all saved checks?
        </h2>
        <p className="mt-2 text-ink-soft">
          This removes every saved report from this browser. It cannot be undone.
        </p>
        <form method="dialog" className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" value="cancel">
            Keep them
          </Button>
          <Button variant="danger" value="clear" onClick={() => clearHistory()}>
            Clear all
          </Button>
        </form>
      </dialog>
    </div>
  );
}
