import type { PosThemeMode } from 'app/theme';
import type { PosRestaurantContext, PosSessionPayload, PosTariff, PosUser } from 'modules/auth/domain';
import type { PosLocale } from 'shared/locale/copy';

const STORAGE_KEY = 'restaurant-pos-session';
const RESTAURANT_CONTEXT_KEY = 'restaurant-pos-context';
const THEME_KEY = 'restaurant-pos-theme-mode';
const LOCALE_KEY = 'restaurant-pos-locale';

type SessionCompatUser = Omit<PosUser, 'fullName' | 'permissionCodes'> & {
  fullName?: string;
  full_name?: string;
  permissionCodes?: string[];
  permission_codes?: string[];
  ui_mode?: string;
};

type SessionCompatTariff = Partial<NonNullable<PosTariff>> & {
  id: string;
  permissionCodes?: string[];
  permission_codes?: string[];
  roleCodes?: string[];
  role_codes?: string[];
};

type LegacySessionPayload = Omit<PosSessionPayload, 'user' | 'tariff' | 'roleCodes'> & {
  user: SessionCompatUser;
  restaurant_context?: PosRestaurantContext | null;
  restaurantContext?: PosRestaurantContext | null;
  restaurant_access_active?: boolean;
  restaurantAccessActive?: boolean;
  role_codes?: string[];
  roleCodes?: string[];
  tariff?: SessionCompatTariff | null;
};

export function normalizeSessionPayload(
  payload: PosSessionPayload | LegacySessionPayload | null,
): PosSessionPayload | null {
  if (!payload) {
    return null;
  }

  const rawUser = payload.user as SessionCompatUser;
  const rawRestaurantContext =
    (payload as LegacySessionPayload).restaurantContext ?? (payload as LegacySessionPayload).restaurant_context ?? null;
  const rawTariff = (payload as LegacySessionPayload).tariff;
  const restaurantAccessActive =
    rawUser.restaurantAccessActive ??
    payload.restaurantAccessActive ??
    (payload as LegacySessionPayload).restaurant_access_active;
  const normalizedTariff: PosTariff = rawTariff
    ? {
        id: rawTariff.id,
        name: rawTariff.name ?? '',
        permissionCodes: rawTariff.permissionCodes ?? rawTariff.permission_codes ?? [],
        roleCodes: rawTariff.roleCodes ?? rawTariff.role_codes ?? [],
      }
    : null;
  const roleCodes =
    payload.roleCodes ?? (payload as LegacySessionPayload).role_codes ?? normalizedTariff?.roleCodes ?? [];

  return {
    token: payload.token,
    user: {
      id: rawUser.id,
      username: rawUser.username,
      fullName: rawUser.fullName ?? rawUser.full_name ?? '',
      permissionCodes: rawUser.permissionCodes ?? rawUser.permission_codes ?? [],
      ...(restaurantAccessActive !== undefined ? { restaurantAccessActive } : {}),
      ...(rawUser.role ? { role: rawUser.role } : {}),
    },
    ...(restaurantAccessActive !== undefined ? { restaurantAccessActive } : {}),
    ...(roleCodes.length ? { roleCodes } : {}),
    ...(normalizedTariff ? { tariff: normalizedTariff } : {}),
    ...(rawRestaurantContext ? { restaurantContext: rawRestaurantContext } : {}),
  };
}

function readJson<T>(key: string): T | null {
  const rawValue = localStorage.getItem(key);
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as T;
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}

export function readStoredSession() {
  return normalizeSessionPayload(readJson<LegacySessionPayload>(STORAGE_KEY));
}

export function persistSession(value: PosSessionPayload | null) {
  const normalizedValue = normalizeSessionPayload(value);

  if (normalizedValue) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizedValue));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export function readStoredRestaurantContext() {
  return readJson<PosRestaurantContext>(RESTAURANT_CONTEXT_KEY);
}

export function persistRestaurantContext(value: PosRestaurantContext | null) {
  if (value) {
    localStorage.setItem(RESTAURANT_CONTEXT_KEY, JSON.stringify(value));
  } else {
    localStorage.removeItem(RESTAURANT_CONTEXT_KEY);
  }
}

export function readStoredThemeMode(): PosThemeMode {
  return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark';
}

export function persistThemeMode(mode: PosThemeMode) {
  localStorage.setItem(THEME_KEY, mode);
}

export function readStoredLocale(): PosLocale {
  const rawValue = localStorage.getItem(LOCALE_KEY);

  if (rawValue === 'uz-crl' || rawValue === 'ru') {
    return rawValue;
  }

  return 'uz';
}

export function persistLocale(locale: PosLocale) {
  localStorage.setItem(LOCALE_KEY, locale);
}
