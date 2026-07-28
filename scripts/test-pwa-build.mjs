import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

const serviceWorkerPath = path.join(process.cwd(), 'dist', 'sw.js');
const serviceWorkerSource = await readFile(serviceWorkerPath, 'utf8');

assert(!serviceWorkerSource.includes('__BUILD_HASH__'), 'The service worker build hash was not injected.');
assert(!serviceWorkerSource.includes('__PRECACHE_MANIFEST__'), 'The service worker manifest was not injected.');

const manifestMatch = serviceWorkerSource.match(/const APP_SHELL = \[([\s\S]*?)\];/);
assert(manifestMatch, 'The generated service worker does not contain an app shell manifest.');
const appShell = JSON.parse(`[${manifestMatch[1]}]`);

assert(appShell.includes('/index.html'), 'The offline app shell must include index.html.');
assert(appShell.includes('/pos-auth-bg-source.png'), 'The offline login background must be cached.');
assert(appShell.some((url) => url.startsWith('/assets/') && url.endsWith('.js')), 'The JavaScript bundle is missing.');
assert(appShell.some((url) => url.startsWith('/assets/') && url.endsWith('.css')), 'The CSS bundle is missing.');
assert(
  appShell.every(
    (url) =>
      ['/index.html', '/manifest.webmanifest', '/favicon.png', '/favicon.svg', '/pos-auth-bg-source.png'].includes(url) ||
      url.startsWith('/assets/') ||
      url.startsWith('/icons/'),
  ),
  'The app shell contains an asset outside the explicit cache allowlist.',
);
assert(!appShell.some((url) => url.includes('pos-auth-bg-clean')), 'Unused login backgrounds must not be cached.');
assert(!appShell.includes('/pos-cafe-bg.png'), 'The unused cafe background must not be cached.');

const handlers = new Map();
const cacheStores = new Map();
let skipWaitingCalls = 0;
let claimCalls = 0;
let networkBehavior = async () => new Response('online', { status: 200 });

function requestKey(request) {
  return typeof request === 'string' ? request : request.url;
}

function createCache(name) {
  if (!cacheStores.has(name)) cacheStores.set(name, new Map());
  const store = cacheStores.get(name);
  return {
    async addAll(urls) {
      for (const url of urls) {
        const body = url === '/index.html' ? '<main>cached POS shell</main>' : `cached ${url}`;
        store.set(url, new Response(body, { status: 200 }));
      }
    },
    async put(request, response) {
      store.set(requestKey(request), response);
    },
    async match(request) {
      return store.get(requestKey(request))?.clone();
    },
  };
}

const cachesMock = {
  async open(name) {
    return createCache(name);
  },
  async keys() {
    return [...cacheStores.keys()];
  },
  async delete(name) {
    return cacheStores.delete(name);
  },
  async match(request) {
    const key = requestKey(request);
    for (const store of cacheStores.values()) {
      if (store.has(key)) return store.get(key).clone();
    }
    return undefined;
  },
};

const serviceWorkerGlobal = {
  location: { origin: 'https://pos.cafe-postcode.uz' },
  setTimeout,
  clearTimeout,
  clients: {
    async claim() {
      claimCalls += 1;
    },
  },
  async skipWaiting() {
    skipWaitingCalls += 1;
  },
  addEventListener(type, handler) {
    handlers.set(type, handler);
  },
};

vm.runInNewContext(serviceWorkerSource, {
  self: serviceWorkerGlobal,
  caches: cachesMock,
  fetch: (request) => networkBehavior(request),
  URL,
  Response,
  Promise,
  Error,
});

function waitableEvent(extra = {}) {
  let promise;
  return {
    event: {
      ...extra,
      waitUntil(value) {
        promise = value;
      },
    },
    wait: async () => promise,
  };
}

const install = waitableEvent();
handlers.get('install')(install.event);
await install.wait();
assert.equal(skipWaitingCalls, 0, 'An update must wait for the cashier instead of activating automatically.');

const currentCacheName = [...cacheStores.keys()].find((name) => name.startsWith('restaurant-pos-shell-'));
assert(currentCacheName, 'The POS app shell cache was not created.');
assert.equal(cacheStores.get(currentCacheName).size, appShell.length, 'Not every app shell file was precached.');

handlers.get('message')({ data: { type: 'IGNORE' } });
assert.equal(skipWaitingCalls, 0, 'Unknown messages must not activate the update.');
handlers.get('message')({ data: { type: 'SKIP_WAITING' } });
assert.equal(skipWaitingCalls, 1, 'The approved update did not activate.');

async function navigateWith(network) {
  networkBehavior = network;
  let responsePromise;
  const request = { method: 'GET', mode: 'navigate', url: 'https://pos.cafe-postcode.uz/cashier' };
  handlers.get('fetch')({
    request,
    respondWith(value) {
      responsePromise = value;
    },
  });
  assert(responsePromise, 'A same-origin navigation was not intercepted.');
  return responsePromise;
}

const cloudflareFailure = await navigateWith(async () => new Response('<h1>521</h1>', { status: 521 }));
assert.equal(cloudflareFailure.status, 200, 'Cloudflare 521 must return the cached POS shell.');
assert.match(await cloudflareFailure.text(), /cached POS shell/, 'Cloudflare 521 returned the wrong fallback.');

const offlineFailure = await navigateWith(async () => {
  throw new Error('offline');
});
assert.equal(offlineFailure.status, 200, 'A network failure must return the cached POS shell.');
assert.match(await offlineFailure.text(), /cached POS shell/, 'Offline navigation returned the wrong fallback.');

let apiWasIntercepted = false;
handlers.get('fetch')({
  request: { method: 'GET', mode: 'cors', url: 'https://pos.cafe-postcode.uz/api/orders' },
  respondWith() {
    apiWasIntercepted = true;
  },
});
assert.equal(apiWasIntercepted, false, 'API requests must remain network-only.');

cacheStores.set('restaurant-pos-shell-old-build', new Map());
cacheStores.set('unrelated-cache', new Map());
const activate = waitableEvent();
handlers.get('activate')(activate.event);
await activate.wait();
assert.equal(claimCalls, 1, 'The approved worker did not claim the page.');
assert.equal(cacheStores.has('restaurant-pos-shell-old-build'), false, 'The old POS cache was not deleted.');
assert.equal(cacheStores.has('unrelated-cache'), true, 'An unrelated cache was deleted.');

console.log(`Verified ${appShell.length} app-shell files, 521/offline fallback, and cashier-approved updates.`);
