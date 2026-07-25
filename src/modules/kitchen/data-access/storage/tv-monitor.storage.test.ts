// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { persistTvMonitorDevice, readTvMonitorDevice } from './tv-monitor.storage';

describe('TV monitor device storage', () => {
  beforeEach(() => window.localStorage.clear());

  afterEach(() => {
    delete window.CafePostcodeTv;
  });

  it('persists the paired restaurant until it is explicitly cleared', () => {
    const device = { token: 'permanent-token', restaurantId: 'restaurant-1', restaurantName: 'Qamish' };

    persistTvMonitorDevice(device);
    expect(readTvMonitorDevice()).toEqual(device);

    persistTvMonitorDevice(null);
    expect(readTvMonitorDevice()).toBeNull();
  });

  it('ignores malformed stored data', () => {
    window.localStorage.setItem('restaurant-pos-tv-monitor-device', '{bad json');
    expect(readTvMonitorDevice()).toBeNull();
  });

  it('restores the paired restaurant from Android storage', () => {
    const device = { token: 'native-token', restaurantId: 'restaurant-2', restaurantName: 'New York' };
    window.CafePostcodeTv = { getDevice: vi.fn(() => JSON.stringify(device)) };

    expect(readTvMonitorDevice()).toEqual(device);
    expect(window.localStorage.getItem('restaurant-pos-tv-monitor-device')).toBe(JSON.stringify(device));
  });

  it('backs up and clears the paired restaurant in Android storage', () => {
    const setDevice = vi.fn();
    const clearDevice = vi.fn();
    window.CafePostcodeTv = { setDevice, clearDevice };
    const device = { token: 'native-token', restaurantId: 'restaurant-2', restaurantName: 'New York' };

    persistTvMonitorDevice(device);
    expect(setDevice).toHaveBeenCalledWith(JSON.stringify(device));

    persistTvMonitorDevice(null);
    expect(clearDevice).toHaveBeenCalledOnce();
  });
});
