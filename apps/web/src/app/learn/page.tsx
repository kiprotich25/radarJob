import type { Metadata } from 'next';
import Link from 'next/link';
import { QUIZ_QUESTIONS } from '@radarjob/shared';
import { GuideSearch } from '@/components/guide-search';
import { buttonVariants } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Learn to spot job scams' };

export default function LearnPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="grid gap-8 md:grid-cols-[1.5fr_1fr] md:items-end">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-ink">
            Learn to spot job scams
          </h1>
          <p className="mt-3 max-w-[60ch] text-lg text-ink-soft">
            Plain-language guides to the scams job seekers meet most often — what they look like,
            how to check an opportunity, and what to do if you have already responded. Every example
            is fictional. Guides work offline once you have opened them.
          </p>
        </div>
        <div className="rounded-[var(--radius-panel)] border border-rule bg-surface p-5">
          <h2 className="font-bold text-ink">Test yourself</h2>
          <p className="mt-1 text-ink-soft">
            {QUIZ_QUESTIONS.length} short scenarios. Could you tell the scam from the real thing?
          </p>
          <Link href="/quiz" className={buttonVariants({ className: 'mt-4' })}>
            Take the quiz
          </Link>
        </div>
      </div>
      <section id="guides" aria-labelledby="guides-title" className="mt-14 scroll-mt-24">
        <h2 id="guides-title" className="mb-4 text-2xl font-extrabold text-ink">
          Scam guides
        </h2>
        <GuideSearch />
      </section>
    </div>
  );
}
