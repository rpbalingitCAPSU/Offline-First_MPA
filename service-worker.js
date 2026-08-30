/**
 * service-worker.js — MPA Monitor
 * Offline-first service worker: cache-first strategy for static assets,
 * stale-while-revalidate for OSM tiles, network-only for inference API,
 * and Background Sync trigger for the upload queue.
 */

const CACHE_NAME = 'mpa-monitor-v1';

/** All static assets that make up the app shell. */
const APP_SHELL = [
  '/',
  '/index.html',
  '/login.html',
  '/dashboard.html',
  '/survey.html',
  '/map.html',
  '/alerts.html',
  '/reports.html',
  '/manifest.json',
  '/css/reset.css',
  '/css/theme.css',
  '/css/components.css',
  '/js/auth.js',
  '/js/db.js',
  '/js/sync.js',
  '/js/inference.js',
  '/js/charts.js',
  '/js/map.js',
  '/js/alerts.js',
  '/js/reports.js',
  '/js/utils.js',
  '/js/watsonx.js',
  '/js/philippines-geo.js',
  '/signup.html',
  // Vendor libs — uncomment once downloaded (see vendor/*/README.md)
  '/vendor/sqljs/sql-wasm.js',
  '/vendor/sqljs/sql-wasm.wasm',
  '/vendor/chartjs/chart.umd.min.js',
  '/vendor/leaflet/leaflet.js',
  '/vendor/leaflet/leaflet.css',
  '/vendor/jspdf/jspdf.umd.min.js',
];

// ── Install ───────────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  console.log('[SW] Installing — caching app shell');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // Use allSettled so missing vendor files don't block install
      Promise.allSettled(
        APP_SHELL.map(url =>
          cache.add(url).catch(err =>
            console.warn(`[SW] Could not cache ${url}:`, err.message)
          )
        )
      )
    )
  );
  // Activate immediately — don't wait for old tabs to close
  self.skipWaiting();
});

// ── Activate ──────────────────────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating — cleaning old caches');
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => {
            console.log('[SW] Removing old cache:', key);
            return caches.delete(key);
          })
      )
    )
  );
  // Take control of all open pages immediately
  self.clients.claim();
});

// ── Fetch ─────────────────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only intercept GET requests over http(s)
  if (request.method !== 'GET') return;
  if (!request.url.startsWith('http')) return;

  const url = new URL(request.url);

  // ① Inference service — network-only (never cache live AI calls)
  if (url.hostname === 'localhost' && url.port === '8000') {
    event.respondWith(fetch(request));
    return;
  }

  // ① IBM watsonx Web Chat CDN — network-only (requires internet; graceful offline fallback in watsonx.js)
  if (url.hostname.includes('watson.appdomain.cloud') ||
      url.hostname.includes('web-chat.global.assistant')) {
    event.respondWith(fetch(request).catch(() => new Response('', { status: 503 })));
    return;
  }

  // ② OSM tile requests — stale-while-revalidate
  if (url.hostname.includes('tile.openstreetmap.org')) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // ③ Everything else — cache-first with network fallback
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        // Only cache valid, non-opaque responses
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
        return response;
      }).catch(() => {
        // Network unavailable — return a basic offline fallback for HTML requests
        if (request.headers.get('accept')?.includes('text/html')) {
          return caches.match('/offline.html') || caches.match('/index.html');
        }
        return new Response('', { status: 503 });
      });
    })
  );
});

// ── Background Sync ───────────────────────────────────────────────────────────

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-queue') {
    console.log('[SW] Background sync triggered — notifying clients');
    event.waitUntil(triggerClientSync());
  }
});

/**
 * The SW cannot directly access the IndexedDB sql.js database.
 * Instead, post a TRIGGER_SYNC message to all window clients so the
 * main thread's sync.js can perform the actual sync.
 */
async function triggerClientSync() {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  if (!clients.length) {
    console.log('[SW] No window clients available for sync trigger');
    return;
  }
  clients.forEach((client) => {
    client.postMessage({ type: 'TRIGGER_SYNC' });
  });
}

// ── Message Handler ───────────────────────────────────────────────────────────

self.addEventListener('message', (event) => {
  // Force the new SW to activate (used by update flow)
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Stale-while-revalidate: serve from cache immediately, update cache in background.
 *
 * @param {Request} request
 * @returns {Promise<Response>}
 */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response && response.status === 200) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  return cached || fetchPromise;
}
