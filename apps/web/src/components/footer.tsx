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
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-4 text-xs sm:px-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 font-extrabold text-ink">
            <RadarMark className="size-5" /> RadarJob
          </span>
          <span className="text-ink-soft">
            Automated warning signs, not guarantees. Always verify employers.
          </span>
        </div>
        <nav aria-label="Footer">
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {links.map((l) => (
              <li key={l.href}>
                <Link className="text-ink-soft hover:text-ink hover:underline" href={l.href}>
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
