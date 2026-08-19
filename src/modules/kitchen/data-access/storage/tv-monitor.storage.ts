import type { TvMonitorDeviceRegistration } from 'modules/kitchen/domain';

const TV_MONITOR_DEVICE_KEY = 'restaurant-pos-tv-monitor-device';

type AndroidTvStorageBridge = {
  getDevice?: () => string;
  setDevice?: (deviceJson: string) => void;
  clearDevice?: () => void;
  onQueueSuccess?: () => void;
};

type LegacyTvMonitorCredential = {
  token: string;
  restaurantId?: string;
  restaurantName?: string;
};

declare global {
  interface Window {
    CafePostcodeTv?: AndroidTvStorageBridge;
  }
}

function readStoredValues() {
  const values: string[] = [];
  try {
    const localValue = window.localStorage.getItem(TV_MONITOR_DEVICE_KEY);
    if (localValue) values.push(localValue);
  } catch {
    // Android storage remains available when localStorage is disabled.
  }

  try {
    const nativeValue = window.CafePostcodeTv?.getDevice?.();
    if (nativeValue && !values.includes(nativeValue)) values.push(nativeValue);
  } catch {
    // A broken native bridge must not prevent a fresh secure pairing.
  }
  return values;
}

function parseObject(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function safeRegistration(value: Record<string, unknown>): TvMonitorDeviceRegistration | null {
  if (
    typeof value.deviceId !== 'string' ||
    typeof value.restaurantId !== 'string' ||
    typeof value.restaurantName !== 'string' ||
    typeof value.leaseExpiresAt !== 'string' ||
    (value.deviceStatus !== 'ACTIVE' && value.deviceStatus !== 'REVOKED')
  ) {
    return null;
  }
  return {
    deviceId: value.deviceId,
    deviceStatus: value.deviceStatus,
    leaseExpiresAt: value.leaseExpiresAt,
    restaurantId: value.restaurantId,
    restaurantName: value.restaurantName,
    ...(value.posMonitorVariant === 'default' || value.posMonitorVariant === 'light_compact'
      ? { posMonitorVariant: value.posMonitorVariant }
      : {}),
  };
}

export function readTvMonitorDevice(): TvMonitorDeviceRegistration | null {
  if (typeof window === 'undefined') return null;
  for (const value of readStoredValues()) {
    const parsed = parseObject(value);
    if (!parsed || 'token' in parsed) continue;
    const registration = safeRegistration(parsed);
    if (registration) return registration;
  }
  return null;
}

export function readLegacyTvMonitorCredential(): LegacyTvMonitorCredential | null {
  if (typeof window === 'undefined') return null;
  for (const value of readStoredValues()) {
    const parsed = parseObject(value);
    if (!parsed || typeof parsed.token !== 'string' || !parsed.token.trim()) continue;
    return {
      token: parsed.token.trim(),
      ...(typeof parsed.restaurantId === 'string' ? { restaurantId: parsed.restaurantId } : {}),
      ...(typeof parsed.restaurantName === 'string' ? { restaurantName: parsed.restaurantName } : {}),
    };
  }
  return null;
}

export function clearTvMonitorBrowserRegistration() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(TV_MONITOR_DEVICE_KEY);
  } catch {
    // Keep clearing the native copy even if browser storage is unavailable.
  }
  try {
    window.CafePostcodeTv?.clearDevice?.();
  } catch {
    // A subsequent safe setDevice call can still overwrite an old credential.
  }
}

export function persistTvMonitorDevice(device: TvMonitorDeviceRegistration | null) {
  if (typeof window === 'undefined') return;
  clearTvMonitorBrowserRegistration();
  if (!device) return;

  const safeDevice: TvMonitorDeviceRegistration = {
    deviceId: device.deviceId,
    deviceStatus: device.deviceStatus,
    leaseExpiresAt: device.leaseExpiresAt,
    restaurantId: device.restaurantId,
    restaurantName: device.restaurantName,
    ...(device.posMonitorVariant ? { posMonitorVariant: device.posMonitorVariant } : {}),
  };
  const serializedDevice = JSON.stringify(safeDevice);
  try {
    window.localStorage.setItem(TV_MONITOR_DEVICE_KEY, serializedDevice);
  } catch {
    // The private key remains in IndexedDB; native storage is only safe metadata.
  }
  try {
    window.CafePostcodeTv?.setDevice?.(serializedDevice);
  } catch {
    // Queue authentication does not depend on this metadata backup.
  }
}
