import type { Metadata } from 'next';
import Link from 'next/link';
import { WifiOff } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';

export const metadata: Metadata = { title: 'You are offline' };

export default function OfflinePage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
      <WifiOff aria-hidden className="mx-auto size-10 text-caution" />
      <h1 className="mt-4 text-3xl font-extrabold text-ink">
        This page isn&apos;t available offline
      </h1>
      <p className="mt-3 text-ink-soft">
        Checking a job link needs an internet connection — RadarJob never guesses a result while you
        are offline. Guides you have opened before, the quiz and your saved checks are still
        available.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/learn" className={buttonVariants()}>
          Read the guides
        </Link>
        <Link href="/history" className={buttonVariants({ variant: 'secondary' })}>
          My saved checks
        </Link>
      </div>
    </div>
  );
}
