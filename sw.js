// Kalam Tuition ERP — Service Worker
// Caches the app shell so the PWA opens instantly after the first load,
// instead of re-downloading the whole file over the network every time.
//
// IMPORTANT: bump CACHE_VERSION every time you upload a new index.html,
// otherwise phones/browsers will keep serving the OLD cached version.

const CACHE_VERSION = 'v15';
const CACHE_NAME = 'ktc-erp-' + CACHE_VERSION;
const APP_SHELL = [
  './',
  './index.html'
];

// ── Install: pre-cache the app shell ──────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: clear out any old cache versions ────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: cache-first for the app shell, so opens are instant ────
// Falls back to network for anything not cached (e.g. WhatsApp links,
// image searches), and updates the cache in the background so the
// NEXT open picks up any change automatically.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached); // offline — fall back to whatever's cached

      // Serve cached instantly if we have it; still refresh in the background.
      return cached || networkFetch;
    })
  );
});
