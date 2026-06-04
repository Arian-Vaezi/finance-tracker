/* Minimal service worker for offline support + installability.
 *
 * Strategy: network-first with a cache fallback. This keeps content fresh
 * (no stale-asset surprises) while still letting the app open offline once it
 * has been visited. It deliberately avoids precaching hashed build assets so it
 * stays simple and never needs regenerating on each deploy.
 */
const CACHE = 'finance-tracker-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  event.respondWith(
    (async () => {
      try {
        const fresh = await fetch(request);
        const cache = await caches.open(CACHE);
        cache.put(request, fresh.clone());
        return fresh;
      } catch {
        const cached = await caches.match(request);
        if (cached) return cached;
        if (request.mode === 'navigate') {
          const shell = (await caches.match('/index.html')) || (await caches.match('/'));
          if (shell) return shell;
        }
        return Response.error();
      }
    })(),
  );
});
