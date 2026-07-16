// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';

import { persistTvMonitorDevice, readTvMonitorDevice } from './tv-monitor.storage';

describe('TV monitor device storage', () => {
  beforeEach(() => window.localStorage.clear());

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
});
