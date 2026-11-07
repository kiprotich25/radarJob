import type { Metadata } from 'next';
import { QUIZ_QUESTIONS } from '@radarjob/shared';
import { Quiz } from '@/components/quiz';

export const metadata: Metadata = { title: 'Scam-awareness quiz' };

export default function QuizPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-4xl font-extrabold tracking-tight text-ink">Could you spot the scam?</h1>
      <p className="mt-3 text-lg text-ink-soft">
        {QUIZ_QUESTIONS.length} quick scenarios based on real scam patterns. All names, numbers and
        websites are fictional. Your answers stay on this device.
      </p>
      <div className="mt-8 rounded-[var(--radius-panel)] border border-rule bg-surface p-5 sm:p-7">
        <Quiz questions={QUIZ_QUESTIONS} />
      </div>
    </div>
  );
}
