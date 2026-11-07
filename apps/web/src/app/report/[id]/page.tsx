import type { Metadata } from 'next';
import { ReportView } from '@/components/report/report-view';

export const metadata: Metadata = { title: 'Link report', robots: { index: false, follow: false } };

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="mb-6 text-3xl font-extrabold tracking-tight text-ink">Link report</h1>
      <ReportView id={id} />
    </div>
  );
}
