'use client';

import { Menu, ScanSearch, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { buttonVariants } from './ui/button';
import { RadarMark } from './radar-mark';

const LINKS = [
  { href: '/', label: 'Home' },
  { href: '/analyze', label: 'Check a Link' },
  { href: '/learn', label: 'Learn' },
  { href: '/learn#guides', label: 'Scam Guides' },
  { href: '/history', label: 'My Checks' },
  { href: '/about', label: 'About' },
];

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : !href.includes('#') && pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-40 border-b border-rule bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/85">
      <nav
        aria-label="Main"
        className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6"
      >
        <Link href="/" className="flex items-center gap-2.5 font-extrabold tracking-tight text-ink">
          <RadarMark className="size-8" />
          <span className="text-lg">RadarJob</span>
        </Link>
        <ul className="ml-6 hidden items-center gap-1 lg:flex">
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                aria-current={isActive(l.href) ? 'page' : undefined}
                className={cn(
                  'rounded-md px-3 py-2 text-[0.95rem] font-medium text-ink-soft hover:bg-paper hover:text-ink',
                  isActive(l.href) &&
                    'text-ink underline decoration-signal decoration-2 underline-offset-[10px]',
                )}
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/analyze"
            className={cn(buttonVariants({ size: 'sm' }), 'hidden sm:inline-flex')}
          >
            <ScanSearch /> Check a Job Link
          </Link>
          <button
            type="button"
            className="inline-flex size-10 items-center justify-center rounded-md text-ink hover:bg-paper lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
            <span className="sr-only">{open ? 'Close menu' : 'Open menu'}</span>
          </button>
        </div>
      </nav>
      {open && (
        <div id="mobile-nav" className="border-t border-rule bg-surface lg:hidden">
          <ul className="mx-auto max-w-6xl px-4 py-3 sm:px-6">
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={isActive(l.href) ? 'page' : undefined}
                  className="block rounded-md px-3 py-3 text-base font-medium text-ink hover:bg-paper aria-[current=page]:bg-signal-wash"
                  onClick={() => setOpen(false)}
                >
                  {l.label}
                </Link>
              </li>
            ))}
            <li className="pt-2 sm:hidden">
              <Link
                href="/analyze"
                className={cn(buttonVariants(), 'w-full')}
                onClick={() => setOpen(false)}
              >
                <ScanSearch /> Check a Job Link
              </Link>
            </li>
          </ul>
        </div>
      )}
    </header>
  );
}
