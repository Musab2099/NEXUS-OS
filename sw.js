// NEXUS service worker
// Bump CACHE_VERSION any time you change the cached file list or want to force-refresh clients.
const CACHE_VERSION = 'nexus-v14';
const NETWORK_TIMEOUT_MS = 10000;

function fetchWithTimeout(request) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS);

  return fetch(request, { signal: controller.signal })
    .then(async (response) => {
      if (typeof response.arrayBuffer !== 'function') return response;
      const body = await response.arrayBuffer();
      return new Response(body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    })
    .finally(() => clearTimeout(timeoutId));
}

const CACHE_FILES = [
  '/',
  '/index.html',
  '/login.html',
  '/health.html',
  '/gym.html',
  '/grind-log.html',
  '/progression-tab.html',
  '/facescan.html',
  '/live-workout.html',
  '/scripts/supabase-client.js',
  '/scripts/auth.js',
  '/scripts/topbar.js',
  '/scripts/sync.js',
  '/scripts/apple-health.js',
  '/scripts/github-health.js',
  '/scripts/sync-service.js',
  '/scripts/theme.js',
  '/scripts/event-horizon.js',
  '/scripts/workout-persistence.js',
  '/scripts/animations.js',
  '/styles/liquid-amethyst.css',
  '/styles/themes.css',
  '/styles/style.css',
  '/styles/event-horizon.css',
  '/styles/animations.css',
  '/data/manifest.json',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon-180.png',
  '/favicon-32.png'
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
      fetchWithTimeout(req)
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
      const fetchPromise = fetchWithTimeout(req)
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
