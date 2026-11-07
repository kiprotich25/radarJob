import Link from 'next/link';
import type { Guide } from '@radarjob/shared';

export function EducationCard({
  guide,
}: {
  guide: Pick<Guide, 'slug' | 'title' | 'summary' | 'readingMinutes'>;
}) {
  return (
    <Link
      href={`/learn/${guide.slug}`}
      className="group block h-full border-t-2 border-ink pt-4 hover:border-signal"
    >
      <h3 className="text-lg font-bold leading-snug text-ink group-hover:text-signal-ink group-hover:underline">
        {guide.title}
      </h3>
      <p className="mt-1.5 text-ink-soft">{guide.summary}</p>
      <p className="mt-2 text-sm text-ink-faint">{guide.readingMinutes} min read</p>
    </Link>
  );
}
