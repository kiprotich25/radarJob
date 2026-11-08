import Link from 'next/link';
import { RadarMark } from './radar-mark';

const links = [
  { href: '/about', label: 'About & methodology' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms & responsible use' },
  { href: 'https://code-blooded-glitch.github.io/CodeBlooded/', label: 'Contact' },
];

export function Footer() {
  return (
    <footer className="mt-12 border-t border-rule bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 text-sm sm:px-6 md:flex-row md:items-center md:justify-between md:gap-2 md:py-4 md:text-xs">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
          <span className="flex shrink-0 items-center gap-1.5 font-extrabold text-ink">
            <RadarMark className="size-5" /> RadarJob
          </span>
          <span className="text-ink-soft">
            Automated warning signs, not guarantees. Always verify employers.
          </span>
        </div>
        <nav aria-label="Footer">
          <ul className="grid grid-cols-2 gap-x-4 gap-y-1 sm:flex sm:flex-wrap">
            {links.map((l) => (
              <li key={l.href}>
                <Link
                  className="inline-block py-1.5 text-ink-soft hover:text-ink hover:underline md:py-0"
                  href={l.href}
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
