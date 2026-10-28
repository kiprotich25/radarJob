'use client';

import { MessageSquareWarning } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import { JOB_AD_MAX_LENGTH, OFFER_CATEGORY_LABELS, type JobAdReport } from '@radarjob/shared';
import { api, ApiClientError, NETWORK_MESSAGE } from '@/lib/api';
import { useOnline } from '@/lib/use-online';
import { cn } from '@/lib/cn';
import { Button } from './ui/button';
import { Textarea } from './ui/field';
import { Panel } from './ui/panel';
import { RISK_STYLE } from './risk-style';
import { EvidenceList } from './report/evidence-list';
import { RecommendedActions } from './report/recommended-actions';
import { SimulatedNotice } from './report/report-body';

/** Check the text of a job advert or recruiter message without a link. */
export function JobAdChecker() {
  const online = useOnline();
  const id = useId();
  const [text, setText] = useState('');
  const [result, setResult] = useState<JobAdReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    if (text.trim().length < 20) {
      setError('Paste at least a sentence or two of the job advert or message.');
      return;
    }
    setBusy(true);
    try {
      setResult(await api.analyzeJobAd(text));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : NETWORK_MESSAGE);
    } finally {
      setBusy(false);
    }
  }

  const s = result ? RISK_STYLE[result.category] : null;
  return (
    <div className="space-y-5">
      <form onSubmit={onSubmit} noValidate className="space-y-3">
        <label htmlFor={id} className="block font-semibold text-ink">
          Advert or message text
        </label>
        <p className="text-sm text-ink-soft">
          Useful when a scam arrives on WhatsApp, SMS or a legitimate job board. The text is not
          stored. Remove anything confidential before pasting.
        </p>
        <Textarea
          id={id}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={JOB_AD_MAX_LENGTH}
          placeholder="Paste the message here"
          aria-invalid={Boolean(error)}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="secondary" disabled={busy || !online}>
            <MessageSquareWarning /> {busy ? 'Checking the text…' : 'Check the text'}
          </Button>
          {!online && <span className="text-sm text-ink-soft">Needs an internet connection.</span>}
        </div>
        {error && (
          <p
            role="alert"
            className="rounded-md border border-danger/30 bg-danger-wash px-3 py-2.5 text-ink"
          >
            {error}
          </p>
        )}
      </form>

      {result && s && (
        <div className="space-y-4" aria-live="polite">
          {result.simulated && <SimulatedNotice />}
          <div
            className={cn(
              'flex items-start gap-3 rounded-[var(--radius-panel)] border-2 p-5',
              s.border,
              s.wash,
            )}
          >
            <s.icon aria-hidden className={cn('size-8 shrink-0', s.text)} />
            <div>
              <p className={cn('text-xl font-extrabold', s.text)}>
                {OFFER_CATEGORY_LABELS[result.category]}
              </p>
              <p className="mt-1 text-ink">{result.explanation.summary}</p>
            </div>
          </div>
          <Panel title="Red flags in the text">
            <EvidenceList
              indicators={result.indicators}
              emptyText="No common scam red flags were found in this text."
            />
            {result.aiStatus !== 'completed' && (
              <p className="mt-4 text-sm text-ink-faint">
                AI review did not run ({result.aiStatus.replace('_', ' ')}); the rule-based checks
                above still ran.
              </p>
            )}
          </Panel>
          <RecommendedActions actions={result.explanation.recommendedActions} />
          <ul className="space-y-1 text-sm text-ink-soft">
            {result.limitations.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
