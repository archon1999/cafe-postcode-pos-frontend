let isRegistered = false;

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

    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    });
  }
}
