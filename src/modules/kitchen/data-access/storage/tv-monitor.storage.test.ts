// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { TvMonitorDeviceRegistration } from 'modules/kitchen/domain';

import {
  clearTvMonitorBrowserRegistration,
  persistTvMonitorDevice,
  readLegacyTvMonitorCredential,
  readTvMonitorDevice,
} from './tv-monitor.storage';

const pairedDevice: TvMonitorDeviceRegistration = {
  deviceId: 'device-1',
  deviceStatus: 'ACTIVE',
  leaseExpiresAt: '2099-01-01T00:00:00Z',
  restaurantId: 'restaurant-1',
  restaurantName: 'Qamish',
  posMonitorVariant: 'light_compact',
};

describe('TV monitor device storage', () => {
  beforeEach(() => window.localStorage.clear());

  afterEach(() => {
    delete window.CafePostcodeTv;
  });

  it('persists only non-secret paired-device metadata', () => {
    persistTvMonitorDevice(pairedDevice);

    expect(readTvMonitorDevice()).toEqual(pairedDevice);
    expect(window.localStorage.getItem('restaurant-pos-tv-monitor-device')).not.toContain('token');

    persistTvMonitorDevice(null);
    expect(readTvMonitorDevice()).toBeNull();
  });

  it('ignores malformed stored data', () => {
    window.localStorage.setItem('restaurant-pos-tv-monitor-device', '{bad json');
    expect(readTvMonitorDevice()).toBeNull();
    expect(readLegacyTvMonitorCredential()).toBeNull();
  });

  it('reads a legacy Android bearer only for migration without copying it into localStorage', () => {
    const legacy = { token: 'legacy-native-token', restaurantId: 'restaurant-2', restaurantName: 'New York' };
    window.CafePostcodeTv = { getDevice: vi.fn(() => JSON.stringify(legacy)) };

    expect(readTvMonitorDevice()).toBeNull();
    expect(readLegacyTvMonitorCredential()).toEqual(legacy);
    expect(window.localStorage.getItem('restaurant-pos-tv-monitor-device')).toBeNull();
  });

  it('overwrites browser and Android bearer storage after migration', () => {
    const setDevice = vi.fn();
    const clearDevice = vi.fn();
    window.CafePostcodeTv = { setDevice, clearDevice };
    window.localStorage.setItem(
      'restaurant-pos-tv-monitor-device',
      JSON.stringify({ token: 'legacy-token', restaurantId: 'restaurant-1', restaurantName: 'Qamish' }),
    );

    persistTvMonitorDevice(pairedDevice);

    expect(clearDevice).toHaveBeenCalledOnce();
    expect(setDevice).toHaveBeenCalledOnce();
    expect(setDevice.mock.calls[0][0]).not.toContain('legacy-token');
    expect(setDevice.mock.calls[0][0]).not.toContain('"token"');
    expect(readLegacyTvMonitorCredential()).toBeNull();
  });

  it('whitelists persisted fields even when an unexpected token exists at runtime', () => {
    persistTvMonitorDevice({ ...pairedDevice, token: 'must-not-leak' } as TvMonitorDeviceRegistration);

    expect(window.localStorage.getItem('restaurant-pos-tv-monitor-device')).not.toContain('must-not-leak');
    expect(readTvMonitorDevice()).toEqual(pairedDevice);
  });

  it('clears both browser and native storage', () => {
    const clearDevice = vi.fn();
    window.CafePostcodeTv = { clearDevice };
    window.localStorage.setItem('restaurant-pos-tv-monitor-device', JSON.stringify(pairedDevice));

    clearTvMonitorBrowserRegistration();

    expect(window.localStorage.getItem('restaurant-pos-tv-monitor-device')).toBeNull();
    expect(clearDevice).toHaveBeenCalledOnce();
  });
});
