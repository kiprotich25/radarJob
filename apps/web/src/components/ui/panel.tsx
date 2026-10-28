import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** A bordered section of a report or page. Headings are real headings for screen readers. */
export function Panel({
  title,
  description,
  children,
  className,
  headingLevel = 2,
  ...rest
}: {
  title?: ReactNode;
  description?: ReactNode;
  headingLevel?: 2 | 3;
  children: ReactNode;
} & HTMLAttributes<HTMLElement>) {
  const H = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <section
      className={cn(
        'rounded-[var(--radius-panel)] border border-rule bg-surface p-5 sm:p-6',
        className,
      )}
      {...rest}
    >
      {title && <H className="text-lg font-bold text-ink">{title}</H>}
      {description && <p className="mt-1 text-sm text-ink-soft">{description}</p>}
      <div className={title || description ? 'mt-4' : undefined}>{children}</div>
    </section>
  );
}
