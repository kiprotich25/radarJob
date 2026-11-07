'use client';

import { CheckCircle2, RotateCcw, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useRef, useState } from 'react';
import { getGuide, type QuizQuestion as Q } from '@radarjob/shared';
import { cn } from '@/lib/cn';
import { Button } from './ui/button';

export function QuizQuestion({
  question,
  index,
  total,
  selected,
  onSelect,
  revealed,
}: {
  question: Q;
  index: number;
  total: number;
  selected: string | null;
  onSelect: (id: string) => void;
  revealed: boolean;
}) {
  const correct = selected === question.correctOptionId;
  return (
    <fieldset className="space-y-4">
      <legend className="text-sm text-ink-soft">
        Question {index + 1} of {total}
      </legend>
      {question.scenario && (
        <p className="rounded-md border-l-4 border-rule-strong bg-paper px-4 py-3 text-ink">
          {question.scenario}
        </p>
      )}
      <p className="text-xl font-bold text-ink">{question.prompt}</p>
      <div className="space-y-2" role="radiogroup">
        {question.options.map((o) => {
          const isSel = selected === o.id;
          const isRight = o.id === question.correctOptionId;
          return (
            <label
              key={o.id}
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-[var(--radius-control)] border bg-surface px-4 py-3 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-signal',
                !revealed && 'border-rule-strong hover:border-signal',
                revealed && isRight && 'border-positive bg-positive-wash',
                revealed && isSel && !isRight && 'border-danger bg-danger-wash',
                revealed && !isSel && !isRight && 'border-rule opacity-70',
                revealed && 'cursor-default',
              )}
            >
              <input
                type="radio"
                name={question.id}
                value={o.id}
                checked={isSel}
                disabled={revealed}
                onChange={() => onSelect(o.id)}
                className="mt-1 size-4 accent-[var(--color-signal)]"
              />
              <span className="flex-1 text-ink">{o.text}</span>
              {revealed && isRight && (
                <span className="flex items-center gap-1 text-sm font-semibold text-positive">
                  <CheckCircle2 aria-hidden className="size-4" />
                  Correct answer
                </span>
              )}
              {revealed && isSel && !isRight && (
                <span className="flex items-center gap-1 text-sm font-semibold text-danger">
                  <XCircle aria-hidden className="size-4" />
                  Your answer
                </span>
              )}
            </label>
          );
        })}
      </div>
      {revealed && (
        <div role="status" className="rounded-md bg-paper p-4">
          <p className={cn('font-bold', correct ? 'text-positive' : 'text-danger')}>
            {correct ? 'That’s right.' : 'Not quite.'}
          </p>
          <p className="mt-1 text-ink">{question.explanation}</p>
          {!correct && <p className="mt-2 text-ink-soft">{question.whyOthersAreWrong}</p>}
        </div>
      )}
    </fieldset>
  );
}

export function Quiz({ questions }: { questions: Q[] }) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const q = questions[index];
  const score = useMemo(
    () => questions.filter((x) => answers[x.id] === x.correctOptionId).length,
    [answers, questions],
  );
  const missedGuides = useMemo(() => {
    const slugs = [
      ...new Set(
        questions
          .filter((x) => answers[x.id] && answers[x.id] !== x.correctOptionId)
          .map((x) => x.guideSlug),
      ),
    ];
    return slugs.map((s) => getGuide(s)).filter((g) => g !== undefined);
  }, [answers, questions]);

  const focusTop = () => requestAnimationFrame(() => headingRef.current?.focus());

  if (done) {
    return (
      <div className="space-y-6">
        <h2 ref={headingRef} tabIndex={-1} className="text-2xl font-extrabold text-ink">
          You scored {score} out of {questions.length}
        </h2>
        <p className="text-ink-soft">
          {score === questions.length
            ? 'Excellent — you recognised every scam pattern. Share what you know with friends who are job hunting.'
            : score >= questions.length * 0.7
              ? 'Good work. A few patterns are worth reviewing.'
              : 'Scammers rely on these patterns being unfamiliar. The guides below explain each one.'}
        </p>
        {missedGuides.length > 0 && (
          <div>
            <h3 className="font-semibold text-ink">Recommended reading</h3>
            <ul className="mt-2 space-y-1">
              {missedGuides.map((g) => (
                <li key={g.slug}>
                  <Link
                    className="text-signal underline-offset-4 hover:underline"
                    href={`/learn/${g.slug}`}
                  >
                    {g.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
        <Button
          variant="secondary"
          onClick={() => {
            setAnswers({});
            setIndex(0);
            setRevealed(false);
            setDone(false);
            focusTop();
          }}
        >
          <RotateCcw /> Take the quiz again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Native progress element: no inline styles, so it works under the strict CSP. */}
      <progress
        aria-label="Quiz progress"
        value={index + (revealed ? 1 : 0)}
        max={questions.length}
        className="h-1.5 w-full overflow-hidden rounded-full [&::-moz-progress-bar]:bg-signal [&::-webkit-progress-bar]:bg-rule [&::-webkit-progress-value]:bg-signal"
      />
      <h2 ref={headingRef} tabIndex={-1} className="sr-only">
        Question {index + 1}
      </h2>
      <QuizQuestion
        question={q}
        index={index}
        total={questions.length}
        selected={answers[q.id] ?? null}
        onSelect={(id) => setAnswers((a) => ({ ...a, [q.id]: id }))}
        revealed={revealed}
      />
      <div className="flex gap-3">
        {!revealed ? (
          <Button onClick={() => setRevealed(true)} disabled={!answers[q.id]}>
            Check answer
          </Button>
        ) : index < questions.length - 1 ? (
          <Button
            onClick={() => {
              setIndex(index + 1);
              setRevealed(false);
              focusTop();
            }}
          >
            Next question
          </Button>
        ) : (
          <Button
            onClick={() => {
              setDone(true);
              focusTop();
            }}
          >
            See my score
          </Button>
        )}
      </div>
    </div>
  );
}
