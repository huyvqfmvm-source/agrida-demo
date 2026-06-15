/* global self, caches, fetch, Response */

const CACHE_NAME = 'agrida-v3';
const scopeUrl = new URL(self.registration.scope);
const scopedPath = (path) => new URL(path, scopeUrl).toString();
const APP_SHELL = [
  scopedPath('./'),
  scopedPath('manifest.json'),
  scopedPath('icons/icon-192x192.png'),
  scopedPath('icons/icon-512x512.png'),
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(APP_SHELL.map((url) => cache.add(url).catch(() => undefined))),
    ),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    const legacyKeys = keys.filter((key) => key !== CACHE_NAME);
    await Promise.all(legacyKeys.map((key) => caches.delete(key)));
    await self.clients.claim();

    if (legacyKeys.length > 0) {
      const windows = await self.clients.matchAll({ type: 'window' });
      await Promise.all(windows.map((client) => client.navigate(client.url)));
    }
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || event.request.url.includes('/api/')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        if (event.request.mode === 'navigate') return caches.match(scopedPath('./'));
        return new Response('Offline', { status: 503 });
      }),
  );
});
