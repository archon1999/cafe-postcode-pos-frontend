const CACHE_NAME = 'restaurant-pos-shell-v11';
const APP_SHELL = ['/', '/manifest.webmanifest', '/icons/pos-icon.svg'];

function isCacheableRequest(request) {
  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return false;
  }

  return APP_SHELL.includes(url.pathname);
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      ),
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) =>
        Promise.all(clients.map((client) => client.navigate(client.url))),
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

  // API requests to the Local Agent are cross-origin loopback requests. Let the
  // browser handle their CORS/PNA checks directly instead of proxying them
  // through the service worker. The worker only owns navigation and app-shell
  // caching; API failures must never be replaced with the cached index page.
  if (url.origin !== self.location.origin || (!isNavigationRequest && !isCacheableRequest(event.request))) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (isNavigationRequest) {
          return networkResponse;
        }

        if (isCacheableRequest(event.request) && networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
        }

        return networkResponse;
      })
      .catch(async () => {
        if (isNavigationRequest) {
          const cachedShell = await caches.match('/');
          if (cachedShell) {
            return cachedShell;
          }
        }

        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }

        if (url.pathname !== '/') {
          return caches.match('/');
        }

        return fetch(event.request)
        .then((networkResponse) => {
          return networkResponse;
        });
      }),
  );
});
