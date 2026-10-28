'use client';

import { RefreshCw, ScanSearch } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AnalysisReport } from '@radarjob/shared';
import { api, ApiClientError } from '@/lib/api';
import { getEntry, getSavedReport, saveReport } from '@/lib/history';
import { Button, buttonVariants } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { ErrorState } from '../states';
import { AnalysisProgress } from './analysis-progress';
import { HistoricalNotice, ReportBody, SimulatedNotice } from './report-body';

type State =
  | { kind: 'loading' }
  | { kind: 'running'; report: AnalysisReport }
  | { kind: 'done'; report: AnalysisReport }
  | { kind: 'historical'; report: AnalysisReport; reason: string }
  | { kind: 'interrupted'; report?: AnalysisReport; message: string }
  | { kind: 'failed'; report: AnalysisReport }
  | { kind: 'error'; title: string; message: string };

const POLL_MS = 1500;
const MAX_POLLS = 120;

export function ReportView({ id }: { id: string }) {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const polls = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastReport = useRef<AnalysisReport | undefined>(undefined);

  const load = useCallback(async () => {
    clearTimeout(timer.current);
    try {
      const report = await api.getReport(id);
      lastReport.current = report;
      if (report.status === 'running') {
        setState({ kind: 'running', report });
        if (++polls.current < MAX_POLLS) timer.current = setTimeout(load, POLL_MS);
        else
          setState({
            kind: 'interrupted',
            report,
            message:
              'The analysis is taking longer than expected. You can check its progress again.',
          });
        return;
      }
      if (report.status === 'failed') {
        setState({ kind: 'failed', report });
        return;
      }
      saveReport(report);
      setState({ kind: 'done', report });
    } catch (e) {
      const saved = getEntry(id);
      const savedReport = saved ? getSavedReport(saved) : null;
      const err = e instanceof ApiClientError ? e : undefined;
      if (savedReport) {
        setState({
          kind: 'historical',
          report: savedReport,
          reason:
            err?.kind === 'http' && err.status === 404
              ? 'The server no longer keeps this report.'
              : (err?.message ?? 'The live report could not be loaded.'),
        });
        return;
      }
      if (err && (err.kind === 'offline' || err.kind === 'network')) {
        setState({
          kind: 'interrupted',
          report: lastReport.current,
          message:
            lastReport.current?.status === 'running'
              ? `${err.message} The analysis may still be finishing on the server — reconnect, then check progress.`
              : err.message,
        });
        return;
      }
      if (err?.kind === 'http' && err.status === 404) {
        setState({
          kind: 'error',
          title: 'Report not found',
          message:
            'This report does not exist, or it has expired. Reports are kept on the server for a limited time.',
        });
        return;
      }
      setState({
        kind: 'error',
        title: 'The report could not be loaded',
        message: err?.message ?? 'Something went wrong.',
      });
    }
  }, [id]);

  useEffect(() => {
    void load();
    return () => clearTimeout(timer.current);
  }, [load]);

  const checkAgain = (
    <Button
      variant="secondary"
      onClick={() => {
        polls.current = 0;
        setState({ kind: 'loading' });
        void load();
      }}
    >
      <RefreshCw /> Check progress
    </Button>
  );
  const newCheck = (
    <Link href="/analyze" className={buttonVariants({ variant: 'secondary' })}>
      <ScanSearch /> Check another link
    </Link>
  );

  switch (state.kind) {
    case 'loading':
      return (
        <div className="space-y-4" aria-busy="true" aria-label="Loading report">
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      );
    case 'running':
      return (
        <div className="space-y-5">
          {state.report.simulated && <SimulatedNotice />}
          <div
            className="rounded-[var(--radius-panel)] border border-signal/40 bg-signal-wash p-5"
            role="status"
          >
            <p className="text-lg font-bold text-ink">
              Analysing {state.report.input.unicodeHostname}…
            </p>
            <p className="mt-1 text-ink-soft">
              RadarJob is collecting evidence from several sources. You can leave this page open;
              the report appears here when it is ready.
            </p>
          </div>
          <AnalysisProgress report={state.report} />
        </div>
      );
    case 'done':
      return (
        <div className="space-y-5">
          {state.report.simulated && <SimulatedNotice />}
          <ReportBody report={state.report} />
          <div className="flex flex-wrap gap-3">
            {newCheck}
            <Link href="/history" className={buttonVariants({ variant: 'ghost' })}>
              View my saved checks
            </Link>
          </div>
        </div>
      );
    case 'historical':
      return (
        <div className="space-y-5">
          <HistoricalNotice analyzedAt={state.report.completedAt ?? state.report.createdAt} />
          <p className="text-sm text-ink-soft">{state.reason}</p>
          {state.report.simulated && <SimulatedNotice />}
          <ReportBody report={state.report} />
          {newCheck}
        </div>
      );
    case 'interrupted':
      return (
        <div className="space-y-5">
          <ErrorState
            title="Verification was interrupted"
            message={state.message}
            action={
              <div className="flex flex-wrap gap-3">
                {checkAgain}
                {newCheck}
              </div>
            }
          />
          {state.report && (
            <AnalysisProgress report={state.report} title="Progress before the interruption" />
          )}
        </div>
      );
    case 'failed':
      return (
        <ErrorState
          title="The analysis could not be completed"
          message={`${state.report.error ?? 'An internal error occurred.'} No assessment was made — please try again.`}
          action={newCheck}
        />
      );
    case 'error':
      return <ErrorState title={state.title} message={state.message} action={newCheck} />;
  }
}
