/* ═══════════════════════════════════════════════════════
   Kalam Tuition ERP — Service Worker v2.0
   Caches app shell for full offline use
═══════════════════════════════════════════════════════ */
const CACHE_NAME   = 'kalam-erp-v2';
const CACHE_STATIC = 'kalam-static-v2';

// Files to cache on install
const SHELL_FILES = [
  './',
  './index.html',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+Tamil:wght@400;500;600;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js',
];

// ── Install: cache shell ─────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(
        SHELL_FILES.map(url => cache.add(url).catch(() => null))
      );
    }).then(() => self.skipWaiting())
  );
});

// ── Activate: clean old caches ───────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME && k !== CACHE_STATIC)
            .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: Cache-first for assets, Network-first for data ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip non-GET and external API requests
  if (event.request.method !== 'GET') return;
  if (url.hostname.includes('script.google.com')) return;
  if (url.hostname.includes('wa.me')) return;
  if (url.pathname.includes('/api/')) return;

  // Google Fonts & Chart.js CDN — cache first
  if (url.hostname.includes('fonts.googleapis.com') ||
      url.hostname.includes('fonts.gstatic.com') ||
      url.hostname.includes('cdnjs.cloudflare.com')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(resp => {
          const clone = resp.clone();
          caches.open(CACHE_STATIC).then(c => c.put(event.request, clone));
          return resp;
        }).catch(() => null);
      })
    );
    return;
  }

  // App shell (index.html) — ALWAYS network-first, never serve stale cached HTML
  // This ensures localStorage is always accessible with fresh page load
  event.respondWith(
    fetch(event.request, { cache: 'no-cache' })
      .then(resp => {
        if (resp && resp.status === 200) {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        }
        return resp;
      })
      .catch(() => {
        // Offline fallback — serve cached version
        return caches.match(event.request);
      })
  );
});

// ── Background sync placeholder ──────────────────────
self.addEventListener('sync', event => {
  if (event.tag === 'sheets-sync') {
    // Future: auto-sync to Google Sheets when back online
    console.log('[SW] Background sync: sheets-sync');
  }
});

// ── Push notification placeholder ────────────────────
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  self.registration.showNotification(data.title || 'Kalam ERP', {
    body: data.body || 'New notification',
    icon: './icon-192.png',
    badge: './icon-192.png',
  });
});
