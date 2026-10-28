import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ExternalLink } from 'lucide-react';
import { GUIDES, getGuide } from '@radarjob/shared';
import { EducationCard } from '@/components/education-card';

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const g = getGuide((await params).slug);
  return g ? { title: g.title, description: g.summary } : { title: 'Guide not found' };
}

function Section({
  title,
  items,
  ordered = false,
}: {
  title: string;
  items: string[];
  ordered?: boolean;
}) {
  const List = ordered ? 'ol' : 'ul';
  return (
    <section className="mt-10">
      <h2 className="text-xl font-extrabold text-ink">{title}</h2>
      <List
        className={
          ordered
            ? 'mt-3 list-decimal space-y-2 pl-5 text-ink'
            : 'mt-3 list-disc space-y-2 pl-5 text-ink'
        }
      >
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </List>
    </section>
  );
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const g = getGuide((await params).slug);
  if (!g) notFound();
  const others = GUIDES.filter((x) => x.slug !== g.slug).slice(0, 3);
  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <Link
        href="/learn#guides"
        className="text-sm font-semibold text-signal underline-offset-4 hover:underline"
      >
        All guides
      </Link>
      <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-ink">{g.title}</h1>
      <p className="mt-2 text-sm text-ink-faint">{g.readingMinutes} min read</p>
      <p className="mt-6 text-lg leading-relaxed text-ink">{g.definition}</p>

      <Section title="How it works" items={g.howItWorks} ordered />
      <Section title="Warning signs" items={g.warningSigns} />

      <section
        className="mt-10 rounded-[var(--radius-panel)] border-2 border-dashed border-rule-strong bg-surface p-5 sm:p-6"
        aria-labelledby="example"
      >
        <p className="text-sm font-semibold text-caution">Fictional example — for learning only</p>
        <h2 id="example" className="mt-1 text-lg font-bold text-ink">
          {g.fictionalExample.title.replace(/^FICTIONAL EXAMPLE — /, '')}
        </h2>
        <p className="mt-3 text-ink">{g.fictionalExample.body}</p>
        <h3 className="mt-4 font-semibold text-ink">Red flags in this example</h3>
        <ul className="mt-2 flex flex-wrap gap-2">
          {g.fictionalExample.redFlags.map((f) => (
            <li
              key={f}
              className="rounded-full border border-caution/40 bg-caution-wash px-3 py-1 text-sm text-ink"
            >
              {f}
            </li>
          ))}
        </ul>
      </section>

      <Section title="How to verify the opportunity" items={g.howToVerify} />
      <Section title="If you have already responded" items={g.ifEngaged} />
      <Section title="Reporting and recovery" items={g.reporting} />

      <section className="mt-10">
        <h2 className="text-xl font-extrabold text-ink">Where to verify or report</h2>
        <p className="mt-1 text-sm text-ink-soft">
          RadarJob is not affiliated with these organisations.
        </p>
        <ul className="mt-4 space-y-4">
          {g.resources.map((r) => (
            <li key={r.url}>
              <a
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-signal underline-offset-4 hover:underline"
              >
                {r.name} <ExternalLink aria-hidden className="size-3.5" />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
              <p className="text-ink-soft">
                {r.description} <span className="text-ink-faint">({r.region})</span>
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-16 border-t border-rule pt-10" aria-labelledby="more">
        <h2 id="more" className="text-xl font-extrabold text-ink">
          More guides
        </h2>
        <ul className="mt-6 grid gap-8 sm:grid-cols-3">
          {others.map((o) => (
            <li key={o.slug}>
              <EducationCard guide={o} />
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}
