import {
  CheckCircle2,
  CircleDashed,
  CircleSlash,
  Loader2,
  MinusCircle,
  XCircle,
} from 'lucide-react';
import { CHECK_STATUS_LABELS, type CheckStatus } from '@radarjob/shared';
import { cn } from '@/lib/cn';

const ICONS: Record<CheckStatus, { Icon: typeof CheckCircle2; cls: string }> = {
  pending: { Icon: CircleDashed, cls: 'text-ink-faint' },
  running: { Icon: Loader2, cls: 'text-signal animate-spin' },
  completed: { Icon: CheckCircle2, cls: 'text-signal' },
  failed: { Icon: XCircle, cls: 'text-danger' },
  unavailable: { Icon: CircleSlash, cls: 'text-unknown' },
  not_configured: { Icon: MinusCircle, cls: 'text-unknown' },
  skipped: { Icon: MinusCircle, cls: 'text-ink-faint' },
};

/** Status of a check. "Completed" means the check ran — not that the result was good. */
export function StatusMark({ status, className }: { status: CheckStatus; className?: string }) {
  const { Icon, cls } = ICONS[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-sm font-medium', className)}>
      <Icon aria-hidden className={cn('size-4', cls)} />
      <span>{CHECK_STATUS_LABELS[status]}</span>
    </span>
  );
}
