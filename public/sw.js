const CACHE_PREFIX = 'restaurant-pos-shell-';
const CACHE_NAME = `${CACHE_PREFIX}__BUILD_HASH__`;
const NAVIGATION_FALLBACK = '/index.html';
const NETWORK_TIMEOUT_MS = 3_000;
const APP_SHELL = [/* __PRECACHE_MANIFEST__ */];

function networkWithTimeout(request) {
  return new Promise((resolve, reject) => {
    const timeout = self.setTimeout(() => reject(new Error('Network timeout')), NETWORK_TIMEOUT_MS);

    fetch(request).then(
      (response) => {
        self.clearTimeout(timeout);
        resolve(response);
      },
      (error) => {
        self.clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

function isApiRequest(url) {
  return url.pathname === '/api' || url.pathname.startsWith('/api/');
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)),
      self.skipWaiting(),
    ]),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    void self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) =>
        Promise.all(
          keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key)),
        ),
      ),
    ]),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);
  const isNavigationRequest = event.request.mode === 'navigate';

  // Local Agent requests are cross-origin loopback calls. Same-origin API calls
  // are also always network-only: an API failure must never become cached HTML.
  if (url.origin !== self.location.origin || isApiRequest(url) || url.pathname === '/sw.js') {
    return;
  }

  if (isNavigationRequest) {
    event.respondWith(
      networkWithTimeout(event.request)
      .then(async (networkResponse) => {
        if (!networkResponse || !networkResponse.ok) {
          const cachedShell = await caches.match(NAVIGATION_FALLBACK, { ignoreSearch: true });
          return cachedShell || networkResponse;
        }

        const responseToCache = networkResponse.clone();
        void caches.open(CACHE_NAME).then((cache) => cache.put(NAVIGATION_FALLBACK, responseToCache));
        return networkResponse;
      })
      .catch(() => caches.match(NAVIGATION_FALLBACK, { ignoreSearch: true })),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.ok) {
          const responseToCache = networkResponse.clone();
          void caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
        }
        return networkResponse;
      });
    }),
  );
});
