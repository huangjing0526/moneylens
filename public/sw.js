// MoneyLens Service Worker
const SW_VERSION = 'v1.0.0';
const CACHE_PREFIX = 'moneylens';
const SHELL_CACHE = `${CACHE_PREFIX}-shell-${SW_VERSION}`;
const STATIC_CACHE = `${CACHE_PREFIX}-static-${SW_VERSION}`;
const API_CACHE = `${CACHE_PREFIX}-api-${SW_VERSION}`;

const PRECACHE_URLS = ['/'];

// Paths that should never be cached
const NEVER_CACHE = ['/api/import', '/api/export', '/api/auth'];

// ------- Install -------
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  // Activate new SW immediately
  self.skipWaiting();
});

// ------- Activate -------
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter(
            (key) =>
              key.startsWith(CACHE_PREFIX) &&
              key !== SHELL_CACHE &&
              key !== STATIC_CACHE &&
              key !== API_CACHE
          )
          .map((key) => caches.delete(key))
      )
    )
  );
  // Take control of all clients immediately
  self.clients.claim();
});

// ------- Helpers -------
function shouldNeverCache(url) {
  return NEVER_CACHE.some((path) => url.pathname.startsWith(path));
}

function isApiRequest(url) {
  return url.pathname.startsWith('/api/');
}

function isStaticAsset(url) {
  return /\.(png|jpg|jpeg|gif|webp|svg|ico|woff2?|ttf|eot)$/i.test(
    url.pathname
  );
}

function isAppShell(url) {
  return url.pathname.startsWith('/_next/');
}

// CacheFirst strategy with max-age
async function cacheFirst(request, cacheName, maxAgeSeconds) {
  const cached = await caches.match(request);
  if (cached) {
    const dateHeader = cached.headers.get('sw-cache-date');
    if (dateHeader) {
      const age = (Date.now() - new Date(dateHeader).getTime()) / 1000;
      if (age > maxAgeSeconds) {
        // Expired — fetch fresh copy
        const fresh = await fetch(request);
        if (fresh.ok) {
          const clone = fresh.clone();
          const headers = new Headers(clone.headers);
          headers.set('sw-cache-date', new Date().toISOString());
          const body = await clone.blob();
          const response = new Response(body, {
            status: clone.status,
            statusText: clone.statusText,
            headers,
          });
          const cache = await caches.open(cacheName);
          cache.put(request, response);
        }
        return fresh;
      }
    }
    return cached;
  }

  const response = await fetch(request);
  if (response.ok) {
    const clone = response.clone();
    const headers = new Headers(clone.headers);
    headers.set('sw-cache-date', new Date().toISOString());
    const body = await clone.blob();
    const timestamped = new Response(body, {
      status: clone.status,
      statusText: clone.statusText,
      headers,
    });
    const cache = await caches.open(cacheName);
    cache.put(request, timestamped);
  }
  return response;
}

// NetworkFirst strategy with cache fallback
async function networkFirst(request, cacheName, maxAgeSeconds) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const clone = response.clone();
      const headers = new Headers(clone.headers);
      headers.set('sw-cache-date', new Date().toISOString());
      const body = await clone.blob();
      const timestamped = new Response(body, {
        status: clone.status,
        statusText: clone.statusText,
        headers,
      });
      const cache = await caches.open(cacheName);
      cache.put(request, timestamped);
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) {
      const dateHeader = cached.headers.get('sw-cache-date');
      if (dateHeader) {
        const age = (Date.now() - new Date(dateHeader).getTime()) / 1000;
        if (age <= maxAgeSeconds) {
          return cached;
        }
      }
      // Return stale cache as last resort
      return cached;
    }
    return new Response(JSON.stringify({ error: 'Offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// ------- Fetch -------
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Never cache certain API routes
  if (shouldNeverCache(url)) return;

  // API requests: NetworkFirst with 1-hour cache
  if (isApiRequest(url)) {
    event.respondWith(networkFirst(event.request, API_CACHE, 60 * 60));
    return;
  }

  // Static assets: CacheFirst with 30-day expiry
  if (isStaticAsset(url)) {
    event.respondWith(
      cacheFirst(event.request, STATIC_CACHE, 30 * 24 * 60 * 60)
    );
    return;
  }

  // App shell (/_next/ bundles): CacheFirst with 7-day expiry
  if (isAppShell(url)) {
    event.respondWith(
      cacheFirst(event.request, SHELL_CACHE, 7 * 24 * 60 * 60)
    );
    return;
  }

  // HTML navigation: NetworkFirst with shell cache fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(networkFirst(event.request, SHELL_CACHE, 7 * 24 * 60 * 60));
    return;
  }
});
