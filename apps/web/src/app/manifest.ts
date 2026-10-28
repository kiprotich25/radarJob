import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'RadarJob — Spot the scam before it costs you',
    short_name: 'RadarJob',
    description: 'Job-scam awareness and suspicious recruitment link checks.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#f4f6f8',
    theme_color: '#13213c',
    categories: ['security', 'education', 'utilities'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
