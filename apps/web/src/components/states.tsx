import type { ReactNode } from 'react';
import { AlertCircle, Inbox } from 'lucide-react';

export function ErrorState({
  title,
  message,
  action,
}: {
  title: string;
  message: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div
      role="alert"
      className="rounded-[var(--radius-panel)] border border-danger/30 bg-danger-wash p-5"
    >
      <div className="flex items-start gap-3">
        <AlertCircle aria-hidden className="mt-0.5 size-5 shrink-0 text-danger" />
        <div>
          <h2 className="font-bold text-ink">{title}</h2>
          <div className="mt-1 text-ink-soft">{message}</div>
          {action && <div className="mt-4">{action}</div>}
        </div>
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-[var(--radius-panel)] border border-dashed border-rule-strong bg-surface px-5 py-10 text-center">
      <Inbox aria-hidden className="mx-auto size-8 text-ink-faint" />
      <h2 className="mt-3 font-bold text-ink">{title}</h2>
      <div className="mx-auto mt-1 max-w-md text-ink-soft">{message}</div>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
