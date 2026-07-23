// NEXUS service worker
// Bump CACHE_VERSION any time you change the cached file list or want to force-refresh clients.
const CACHE_VERSION = 'nexus-v5';

const CACHE_FILES = [
  './',
  './src/pages/index.html',
  './src/pages/health.html',
  './src/pages/gym.html',
  './src/pages/grind-log.html',
  './src/pages/progression-tab.html',
  './src/scripts/topbar.js',
  './src/scripts/sync.js',
  './src/data/manifest.json',
  './public/icon-192.png',
  './public/icon-512.png',
  './public/apple-touch-icon-180.png',
  './public/favicon-32.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(CACHE_FILES))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Never intercept cross-origin requests — this lets Supabase API calls
  // (and anything else not on your domain) go straight to the network,
  // untouched by the cache.
  if (url.origin !== self.location.origin) return;

  // Only handle GET requests; let POST/PUT/etc. (e.g. Supabase writes if
  // ever proxied same-origin) pass through untouched.
  if (req.method !== 'GET') return;

  const isPage = req.mode === 'navigate' || req.destination === 'document';

  if (isPage) {
    // Network-first for HTML pages: always tries to get the freshest
    // version, falls back to the cached copy if offline.
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Stale-while-revalidate for static assets (JS, icons, manifest):
  // serve instantly from cache, then refresh the cache in the background.
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
