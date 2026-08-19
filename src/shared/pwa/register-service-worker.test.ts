// @vitest-environment jsdom
// @vitest-environment-options { "url": "https://pos.cafe-postcode.uz" }

import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('service worker update lifecycle', () => {
  beforeEach(() => {
    vi.resetModules();
    window.sessionStorage.clear();
  });

  it('keeps an update waiting, but activates it when the cashier reloads the page', async () => {
    const waitingWorker = { postMessage: vi.fn() } as unknown as ServiceWorker;
    const registration = {
      waiting: waitingWorker,
      installing: null,
      addEventListener: vi.fn(),
    } as unknown as ServiceWorkerRegistration;
    const serviceWorker = {
      controller: {} as ServiceWorker,
      register: vi.fn().mockResolvedValue(registration),
      addEventListener: vi.fn(),
      getRegistrations: vi.fn(),
    } as unknown as ServiceWorkerContainer;
    Object.defineProperty(window.navigator, 'serviceWorker', { configurable: true, value: serviceWorker });

    const { registerServiceWorker, subscribeToServiceWorkerUpdate } = await import('./register-service-worker');
    const updateStates: boolean[] = [];
    subscribeToServiceWorkerUpdate((isReady) => updateStates.push(isReady));
    registerServiceWorker();
    window.dispatchEvent(new Event('load'));

    await vi.waitFor(() => expect(serviceWorker.register).toHaveBeenCalledWith('/sw.js'));
    await vi.waitFor(() => expect(updateStates[updateStates.length - 1]).toBe(true));
    expect(waitingWorker.postMessage).not.toHaveBeenCalled();

    window.dispatchEvent(new Event('beforeunload'));

    expect(window.sessionStorage.getItem('cafe-pos.activate-update-on-reload')).toBe('1');
    expect(waitingWorker.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
  });
});
