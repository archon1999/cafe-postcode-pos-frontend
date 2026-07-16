import type { TvMonitorDeviceRegistration } from 'modules/kitchen/domain';

const TV_MONITOR_DEVICE_KEY = 'restaurant-pos-tv-monitor-device';

export function readTvMonitorDevice(): TvMonitorDeviceRegistration | null {
  if (typeof window === 'undefined') return null;

  try {
    const value = JSON.parse(window.localStorage.getItem(TV_MONITOR_DEVICE_KEY) ?? 'null') as unknown;
    if (
      !value ||
      typeof value !== 'object' ||
      !('token' in value) ||
      !('restaurantId' in value) ||
      !('restaurantName' in value) ||
      typeof value.token !== 'string' ||
      typeof value.restaurantId !== 'string' ||
      typeof value.restaurantName !== 'string'
    ) {
      return null;
    }
    return value as TvMonitorDeviceRegistration;
  } catch {
    return null;
  }
}

export function persistTvMonitorDevice(device: TvMonitorDeviceRegistration | null) {
  if (typeof window === 'undefined') return;
  if (device) {
    window.localStorage.setItem(TV_MONITOR_DEVICE_KEY, JSON.stringify(device));
  } else {
    window.localStorage.removeItem(TV_MONITOR_DEVICE_KEY);
  }
}
