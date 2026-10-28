import type { Metadata } from 'next';
import { Suspense } from 'react';
import { HistoryList } from '@/components/history-list';

export const metadata: Metadata = { title: 'My saved checks', robots: { index: false } };

export default function HistoryPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-4xl font-extrabold tracking-tight text-ink">My saved checks</h1>
      <p className="mt-3 max-w-[62ch] text-lg text-ink-soft">
        Reports you have completed on this device. They are historical copies — open one to see what
        was found at the time, or run a new check for current results.
      </p>
      <div className="mt-8">
        <Suspense fallback={null}>
          <HistoryList />
        </Suspense>
      </div>
    </div>
  );
}
