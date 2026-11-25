/* ==========================================================================
   QuantalFlow PWA Service Worker — Offline-First Caching & Push Support
   ========================================================================== */
const CACHE_NAME = 'quantalflow-v1';
const APP_SHELL = [
  '/dashboard/',
  '/dashboard/leaf/',
  '/assets/css/styles.css',
  '/assets/css/pages.css',
  '/assets/css/leaf.css',
  '/assets/css/mobile-ux.css',
  '/assets/js/mobile-ux.js',
  '/assets/js/qf-dialog.js',
  '/assets/js/save-state.js',
  '/assets/img/favicon-192.png',
  '/manifest.webmanifest'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // API requests: network-first with cached fallback for offline reads
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && (url.pathname === '/api/leaf' || url.pathname === '/api/boards' || url.pathname === '/api/auth/me')) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || new Response(JSON.stringify({ offline: true }), { status: 503, headers: { 'Content-Type': 'application/json' } })))
    );
    return;
  }

  // HTML navigation: network-first, fall back to cache when offline
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match('/dashboard/')))
    );
    return;
  }

  // Static assets: stale-while-revalidate
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('push', (event) => {
  const data = event.data ? (() => { try { return event.data.json(); } catch { return { title: 'QuantalFlow', body: event.data.text() }; } })() : { title: 'QuantalFlow', body: 'New workspace update' };
  event.waitUntil(
    self.registration.showNotification(data.title || 'QuantalFlow', {
      body: data.body || '',
      icon: '/assets/img/favicon-192.png',
      badge: '/assets/img/favicon-192.png',
      data: { url: data.url || '/dashboard/' }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/dashboard/';
  event.waitUntil(self.clients.openWindow(target));
});
