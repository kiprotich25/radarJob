import { Panel } from '../ui/panel';

export function LimitationsNotice({
  unknowns,
  limitations,
}: {
  unknowns: string[];
  limitations: string[];
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Panel title="What remains unknown">
        <ul className="space-y-2 text-ink-soft">
          {unknowns.map((u) => (
            <li key={u} className="flex gap-2">
              <span
                aria-hidden
                className="mt-2.5 size-1.5 shrink-0 rounded-full border border-ink-faint"
              />
              {u}
            </li>
          ))}
        </ul>
      </Panel>
      <Panel title="Limitations">
        <ul className="space-y-2 text-ink-soft">
          {limitations.map((l) => (
            <li key={l} className="flex gap-2">
              <span aria-hidden className="mt-2.5 size-1.5 shrink-0 rounded-full bg-ink-faint" />
              {l}
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
