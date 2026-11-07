import type { Metadata } from 'next';
import { JobAdChecker } from '@/components/job-ad-checker';
import { UrlAnalyzerForm } from '@/components/url-analyzer-form';

export const metadata: Metadata = { title: 'Check a job link' };

export default function AnalyzePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-4xl font-extrabold tracking-tight text-ink">Check a job link</h1>
      <p className="mt-3 text-lg text-ink-soft">
        RadarJob checks the link&apos;s reputation, who registered it and how it is built, then
        explains what it found. Add the advert text too, so the offer itself can be checked.
      </p>
      <div className="mt-8 rounded-[var(--radius-panel)] border border-rule bg-surface p-5 sm:p-6">
        <UrlAnalyzerForm withJobAd showAnatomy />
      </div>

      <section aria-labelledby="text-only" className="mt-14">
        <h2 id="text-only" className="text-2xl font-extrabold text-ink">
          No link? Check the message instead
        </h2>
        <p className="mt-2 text-ink-soft">
          Many job scams never use a website. Paste a recruiter&apos;s message to look for common
          red flags.
        </p>
        <div className="mt-6 rounded-[var(--radius-panel)] border border-rule bg-surface p-5 sm:p-6">
          <JobAdChecker />
        </div>
      </section>
    </div>
  );
}
