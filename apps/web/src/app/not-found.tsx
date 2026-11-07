import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
      <h1 className="text-3xl font-extrabold text-ink">Page not found</h1>
      <p className="mt-3 text-ink-soft">
        The page you were looking for doesn&apos;t exist. If you followed a link from a message,
        double-check where it came from.
      </p>
      <Link href="/" className={buttonVariants({ className: 'mt-8' })}>
        Go to the homepage
      </Link>
    </div>
  );
}
