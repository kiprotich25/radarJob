/*
 * RadarJob service worker.
 *
 * Rules:
 * - /api/* is NEVER cached or intercepted. Live verification only happens online,
 *   and nothing is queued for later.
 * - Static build assets are cache-first (they are content-hashed).
 * - Pages are network-first; a cached copy is used only when the network fails,
 *   so guides, the quiz and saved reports work offline.
 * - Report pages (/report/*) are not cached: a cached live report could be
 *   mistaken for a fresh one. Saved reports are read from local storage on /history.
 */
const VERSION = 'radarjob-v1';
const STATIC_CACHE = `${VERSION}-static`;
const PAGE_CACHE = `${VERSION}-pages`;
const OFFLINE_URL = '/offline';

const CACHEABLE_PAGE =
  /^\/($|learn(\/[a-z0-9-]+)?$|quiz$|history$|about$|privacy$|terms$|offline$|analyze$)/;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PAGE_CACHE);
      let paths = ['/', OFFLINE_URL, '/learn', '/quiz', '/history'];
      try {
        const res = await fetch('/guide-index.json', { cache: 'no-store' });
        if (res.ok) paths = (await res.json()).paths;
      } catch {
        /* fall back to the minimal list */
      }
      // Pre-cache best-effort: one failing page must not block installation.
      await Promise.all(
        paths.map(async (p) => {
          try {
            const res = await fetch(p, { cache: 'no-store', credentials: 'same-origin' });
            if (res.ok) await cache.put(p, res);
          } catch {
            /* ignore */
          }
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return; // live data: browser handles it, no caching

  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(STATIC_CACHE);
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      })(),
    );
    return;
  }

  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cacheable = CACHEABLE_PAGE.test(url.pathname) && !url.search;
        try {
          const res = await fetch(req);
          if (cacheable && res.ok) {
            const cache = await caches.open(PAGE_CACHE);
            cache.put(url.pathname, res.clone());
          }
          return res;
        } catch {
          const cache = await caches.open(PAGE_CACHE);
          // /history?report=... renders a saved report from local storage, so the /history shell is fine.
          const key = url.pathname === '/history' ? '/history' : url.pathname;
          return (
            (cacheable || url.pathname === '/history' ? await cache.match(key) : undefined) ??
            (await cache.match(OFFLINE_URL)) ??
            Response.error()
          );
        }
      })(),
    );
  }
});
