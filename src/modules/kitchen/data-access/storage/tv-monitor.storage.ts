import type { TvMonitorDeviceRegistration } from 'modules/kitchen/domain';

const TV_MONITOR_DEVICE_KEY = 'restaurant-pos-tv-monitor-device';

type AndroidTvStorageBridge = {
  getDevice?: () => string;
  setDevice?: (deviceJson: string) => void;
  clearDevice?: () => void;
  onQueueSuccess?: () => void;
};

declare global {
  interface Window {
    CafePostcodeTv?: AndroidTvStorageBridge;
  }
}

function readDeviceValue() {
  const localValue = window.localStorage.getItem(TV_MONITOR_DEVICE_KEY);
  if (localValue) return localValue;

  const nativeValue = window.CafePostcodeTv?.getDevice?.();
  if (nativeValue) window.localStorage.setItem(TV_MONITOR_DEVICE_KEY, nativeValue);
  return nativeValue || null;
}

export function readTvMonitorDevice(): TvMonitorDeviceRegistration | null {
  if (typeof window === 'undefined') return null;

  try {
    const value = JSON.parse(readDeviceValue() ?? 'null') as unknown;
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
    const serializedDevice = JSON.stringify(device);
    window.localStorage.setItem(TV_MONITOR_DEVICE_KEY, serializedDevice);
    window.CafePostcodeTv?.setDevice?.(serializedDevice);
  } else {
    window.localStorage.removeItem(TV_MONITOR_DEVICE_KEY);
    window.CafePostcodeTv?.clearDevice?.();
  }
}
