import { Panel } from '../ui/panel';

export function RecommendedActions({ actions }: { actions: string[] }) {
  return (
    <Panel title="What to do next" className="border-signal/40">
      <ol className="space-y-3">
        {actions.map((a, i) => (
          <li key={a} className="flex gap-3">
            <span
              aria-hidden
              className="tabular flex size-6 shrink-0 items-center justify-center rounded-full bg-signal-wash text-sm font-bold text-signal-ink"
            >
              {i + 1}
            </span>
            <span className="text-ink">{a}</span>
          </li>
        ))}
      </ol>
    </Panel>
  );
}
