'use client';

import { LockKeyhole, ScanSearch, WifiOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useId, useState, type FormEvent } from 'react';
import { JOB_AD_MAX_LENGTH, validateAndNormalizeUrl } from '@radarjob/shared';
import { api, ApiClientError, NETWORK_MESSAGE, OFFLINE_MESSAGE } from '@/lib/api';
import { useOnline } from '@/lib/use-online';
import { cn } from '@/lib/cn';
import { Button } from './ui/button';
import { Input, Textarea } from './ui/field';
import { LinkAnatomy } from './link-anatomy';

interface Props {
  /** Show the optional job-advert textarea. */
  withJobAd?: boolean;
  showAnatomy?: boolean;
  className?: string;
  /** Lets a parent show the live link anatomy elsewhere in the layout. */
  onUrlChange?: (url: string) => void;
}

export function UrlAnalyzerForm({
  withJobAd = false,
  showAnatomy = false,
  className,
  onUrlChange,
}: Props) {
  const router = useRouter();
  const online = useOnline();
  const urlId = useId();
  const errId = useId();
  const adId = useId();
  const [url, setUrl] = useState('');
  const [jobAd, setJobAd] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const v = validateAndNormalizeUrl(url);
    if (!v.ok) {
      setError(v.message);
      return;
    }
    // A quick hint only; real request failures are handled below. Never queued for later.
    if (!navigator.onLine) {
      setError(OFFLINE_MESSAGE);
      return;
    }
    setSubmitting(true);
    try {
      const { id } = await api.startAnalysis(url.trim(), withJobAd ? jobAd : undefined);
      router.push(`/report/${id}`);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : NETWORK_MESSAGE);
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className={cn('space-y-4', className)}
      aria-describedby={error ? errId : undefined}
    >
      <div>
        <label htmlFor={urlId} className="block font-semibold text-ink">
          Job link to check
        </label>
        <p className="text-sm text-ink-soft">
          Paste the link exactly as you received it. RadarJob will not open it in your browser.
        </p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <Input
            id={urlId}
            name="url"
            type="text"
            inputMode="url"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="https://"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              onUrlChange?.(e.target.value);
            }}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errId : undefined}
            maxLength={2200}
            className="sm:flex-1"
          />
          <Button type="submit" size="lg" disabled={submitting || !online} className="sm:min-w-44">
            {online ? <ScanSearch /> : <WifiOff />}
            {submitting ? 'Starting analysis…' : 'Analyze Link'}
          </Button>
        </div>
      </div>

      {withJobAd && (
        <details className="group rounded-[var(--radius-panel)] border border-rule bg-surface">
          <summary className="cursor-pointer list-none px-4 py-3 font-semibold text-ink marker:hidden">
            <span className="text-signal group-open:hidden">+ </span>
            <span className="hidden text-signal group-open:inline">− </span>
            Add the job advert or recruiter message (optional)
          </summary>
          <div className="space-y-2 border-t border-rule px-4 py-4">
            <label htmlFor={adId} className="font-medium text-ink">
              Advert or message text
            </label>
            <p className="text-sm text-ink-soft">
              Checks the offer itself for red flags such as fees or requests for PINs. Remove
              anything confidential first. The text is not stored; phone numbers, emails and ID-like
              numbers are replaced with placeholders before any AI review.
            </p>
            <Textarea
              id={adId}
              value={jobAd}
              onChange={(e) => setJobAd(e.target.value)}
              maxLength={JOB_AD_MAX_LENGTH}
              placeholder="Paste the advert or message here"
            />
            <p className="tabular text-right text-sm text-ink-faint">
              {jobAd.length.toLocaleString()} / {JOB_AD_MAX_LENGTH.toLocaleString()}
            </p>
          </div>
        </details>
      )}

      {error && (
        <p
          id={errId}
          role="alert"
          className="rounded-md border border-danger/30 bg-danger-wash px-3 py-2.5 text-ink"
        >
          {error}
        </p>
      )}
      {!online && !error && (
        <p
          role="status"
          className="rounded-md border border-caution/30 bg-caution-wash px-3 py-2.5 text-ink"
        >
          {OFFLINE_MESSAGE}
        </p>
      )}

      <p className="flex items-start gap-2 text-sm text-ink-soft">
        <LockKeyhole aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span>
          Live checks need an internet connection. The link is sent to VirusTotal and other services
          for analysis, and they may keep it under their own policies. Don&apos;t submit
          password-reset links, private document links or links that log you in.
        </span>
      </p>

      {showAnatomy && <LinkAnatomy value={validateAndNormalizeUrl(url).ok ? url : ''} />}
    </form>
  );
}
