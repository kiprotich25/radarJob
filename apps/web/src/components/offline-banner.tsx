'use client';

import { WifiOff } from 'lucide-react';
import { useOnline } from '@/lib/use-online';

export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div role="status" className="border-b border-caution/30 bg-caution-wash">
      <p className="mx-auto flex max-w-6xl items-start gap-2 px-4 py-2.5 text-sm text-ink sm:px-6">
        <WifiOff className="mt-0.5 size-4 shrink-0 text-caution" aria-hidden />
        <span>
          <strong className="font-semibold">You&apos;re offline.</strong> Guides, the quiz and your
          saved reports still work. Checking a link needs an internet connection.
        </span>
      </p>
    </div>
  );
}
