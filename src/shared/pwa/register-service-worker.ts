let isRegistered = false;
let waitingWorker: ServiceWorker | null = null;
let shouldReloadForUpdate = false;
const updateListeners = new Set<(isReady: boolean) => void>();
const UPDATE_ON_RELOAD_KEY = 'cafe-pos.activate-update-on-reload';

function publishUpdate(isReady: boolean) {
  updateListeners.forEach((listener) => listener(isReady));
}

function setWaitingWorker(worker: ServiceWorker | null) {
  waitingWorker = worker;
  publishUpdate(Boolean(worker));
}

function activateWaitingWorker(reloadAfterActivation: boolean) {
  if (!waitingWorker) return false;
  const worker = waitingWorker;
  shouldReloadForUpdate = reloadAfterActivation;
  setWaitingWorker(null);
  worker.postMessage({ type: 'SKIP_WAITING' });
  return true;
}

function trackRegistration(registration: ServiceWorkerRegistration) {
  const activateOnReload = window.sessionStorage.getItem(UPDATE_ON_RELOAD_KEY) === '1';
  window.sessionStorage.removeItem(UPDATE_ON_RELOAD_KEY);

  if (registration.waiting && navigator.serviceWorker.controller) {
    setWaitingWorker(registration.waiting);
    if (activateOnReload) activateWaitingWorker(true);
  }

  registration.addEventListener('updatefound', () => {
    const installingWorker = registration.installing;
    if (!installingWorker) return;

    installingWorker.addEventListener('statechange', () => {
      if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
        setWaitingWorker(registration.waiting || installingWorker);
      }
    });
  });
}

export function subscribeToServiceWorkerUpdate(listener: (isReady: boolean) => void) {
  updateListeners.add(listener);
  listener(Boolean(waitingWorker));
  return () => {
    updateListeners.delete(listener);
  };
}

export function applyServiceWorkerUpdate() {
  return activateWaitingWorker(true);
}

export function registerServiceWorker() {
  if (isRegistered) {
    return;
  }
  isRegistered = true;

  const hostname = window.location.hostname;
  const isLocalDevelopment = hostname === 'localhost' || hostname === '127.0.0.1';

  if ('serviceWorker' in navigator) {
    if (isLocalDevelopment) {
      void navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
        .catch(() => undefined);

      if ('caches' in window) {
        void caches
          .keys()
          .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
          .catch(() => undefined);
      }

      return;
    }

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!shouldReloadForUpdate) return;
      shouldReloadForUpdate = false;
      window.location.reload();
    });

    window.addEventListener('beforeunload', () => {
      if (!waitingWorker) return;
      window.sessionStorage.setItem(UPDATE_ON_RELOAD_KEY, '1');
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    });

    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then(trackRegistration)
        .catch(() => undefined);
    });
  }
}
