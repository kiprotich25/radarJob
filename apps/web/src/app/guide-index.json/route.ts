import { GUIDES } from '@radarjob/shared';

export const dynamic = 'force-static';

/** Paths the service worker pre-caches so guides work offline. */
export function GET() {
  return Response.json({
    version: GUIDES.map((g) => g.slug).join(',').length,
    paths: [
      '/',
      '/learn',
      '/quiz',
      '/history',
      '/about',
      '/privacy',
      '/terms',
      '/offline',
      '/analyze',
      ...GUIDES.map((g) => `/learn/${g.slug}`),
    ],
  });
}
