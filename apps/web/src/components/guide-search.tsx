'use client';

import { Search } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { searchGuides } from '@radarjob/shared';
import { Input } from './ui/field';
import { EducationCard } from './education-card';
import { EmptyState } from './states';

/** Client-side search over bundled guides — works offline once the page is cached. */
export function GuideSearch() {
  const id = useId();
  const [q, setQ] = useState('');
  const results = useMemo(() => searchGuides(q), [q]);
  return (
    <div>
      <label htmlFor={id} className="block font-semibold text-ink">
        Search the guides
      </label>
      <div className="relative mt-2 max-w-xl">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-faint"
        />
        <Input
          id={id}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Try “fee”, “WhatsApp” or “OTP”"
          className="pl-10"
        />
      </div>
      <p className="mt-2 text-sm text-ink-soft" aria-live="polite">
        {q
          ? `${results.length} guide${results.length === 1 ? '' : 's'} found`
          : `${results.length} guides`}
      </p>
      {results.length ? (
        <ul className="mt-6 grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((g) => (
            <li key={g.slug}>
              <EducationCard guide={g} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-6">
          <EmptyState
            title="No guides match"
            message="Try a shorter word, such as “fee”, “phishing” or “interview”."
          />
        </div>
      )}
    </div>
  );
}
