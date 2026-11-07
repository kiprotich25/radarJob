import '@fontsource-variable/public-sans';
import './globals.css';
import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import type { ReactNode } from 'react';
import { Footer } from '@/components/footer';
import { Navbar } from '@/components/navbar';
import { OfflineBanner } from '@/components/offline-banner';
import { ServiceWorkerRegister } from '@/components/service-worker-register';

export const metadata: Metadata = {
  title: { default: 'RadarJob — Spot the scam before it costs you', template: '%s · RadarJob' },
  description:
    'Learn to recognise job scams and check suspicious recruitment links using security intelligence and AI-assisted analysis.',
  applicationName: 'RadarJob',
  appleWebApp: { capable: true, title: 'RadarJob', statusBarStyle: 'default' },
  icons: { icon: '/icons/icon.svg', apple: '/icons/apple-touch-icon.png' },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: '#13213c',
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Reading request headers makes every page render per request, which lets Next.js apply the CSP nonce.
  await headers();
  return (
    <html lang="en">
      <body className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-surface focus:px-4 focus:py-2"
        >
          Skip to content
        </a>
        <Navbar />
        <OfflineBanner />
        <main id="main" className="flex-1">
          {children}
        </main>
        <Footer />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
