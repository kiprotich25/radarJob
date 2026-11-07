import Link from 'next/link';
import { RadarMark } from './radar-mark';

export function Footer() {
  return (
    <footer className="mt-24 border-t border-rule bg-surface">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.4fr_1fr]">
        <div>
          <div className="flex items-center gap-2.5 font-extrabold text-ink">
            <RadarMark className="size-7" /> RadarJob
          </div>
          <p className="mt-3 max-w-md text-sm text-ink-soft">
            Spot the scam before it costs you. RadarJob gives automated warning signs, not
            guarantees — always verify an employer through its official channels before paying or
            sharing personal information.
          </p>
        </div>
        <nav aria-label="Footer">
          <ul className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <li>
              <Link className="text-ink-soft hover:text-ink hover:underline" href="/about">
                About &amp; methodology
              </Link>
            </li>
            <li>
              <Link className="text-ink-soft hover:text-ink hover:underline" href="/privacy">
                Privacy
              </Link>
            </li>
            <li>
              <Link className="text-ink-soft hover:text-ink hover:underline" href="/terms">
                Terms &amp; responsible use
              </Link>
            </li>
            <li>
              <Link className="text-ink-soft hover:text-ink hover:underline" href="https://code-blooded-glitch.github.io/CodeBlooded/">
                Contact
              </Link>
            </li>
            <li>
              <Link className="text-ink-soft hover:text-ink hover:underline" href="/learn">
                Scam guides
              </Link>
            </li>
            <li>
              <Link className="text-ink-soft hover:text-ink hover:underline" href="/quiz">
                Scam-awareness quiz
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
