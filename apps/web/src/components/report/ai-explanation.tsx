import { Sparkles, FileText } from 'lucide-react';
import type { Explanation } from '@radarjob/shared';
import { Panel } from '../ui/panel';

export function AIExplanation({
  explanation,
  conflicts,
}: {
  explanation: Explanation;
  conflicts: string[];
}) {
  const ai = explanation.source === 'ai';
  return (
    <Panel
      title="In plain language"
      description={
        <span className="inline-flex items-center gap-1.5">
          {ai ? (
            <Sparkles aria-hidden className="size-3.5" />
          ) : (
            <FileText aria-hidden className="size-3.5" />
          )}
          {ai
            ? 'Written by an AI model from the verified findings below. It cannot change the assessment.'
            : 'Written from a fixed template based on the findings below.'}
        </span>
      }
    >
      <p className="text-[1.05rem] leading-relaxed text-ink">{explanation.summary}</p>
      {(explanation.whyItMatters.length > 0 || conflicts.length > 0) && (
        <div className="mt-5">
          <h3 className="font-semibold text-ink">Why it matters</h3>
          <ul className="mt-2 space-y-2 text-ink-soft">
            {[...new Set([...explanation.whyItMatters, ...conflicts])].map((w) => (
              <li key={w} className="flex gap-2">
                <span aria-hidden className="mt-2.5 size-1.5 shrink-0 rounded-full bg-signal" />
                {w}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}
