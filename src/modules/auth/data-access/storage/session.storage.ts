import type { PosThemeMode } from 'app/theme';
import type { PosFeatureConfig, PosRestaurantContext, PosSessionPayload, PosUser } from 'modules/auth/domain';
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

type LegacyFeatureConfig = Partial<NonNullable<PosFeatureConfig>> & {
  id: string;
  hall_enabled?: boolean;
  kitchen_enabled?: boolean;
  cashier_enabled?: boolean;
  owner_dashboard_enabled?: boolean;
  order_entry_mode?: 'hall' | 'cashier_builder';
  kitchen_mode?: 'display' | 'printer' | 'both';
  enabled_modules?: string[];
  enabled_roles?: string[];
};

type SessionCompatFeatureConfig = LegacyFeatureConfig & {
  hallEnabled?: boolean;
  kitchenEnabled?: boolean;
  cashierEnabled?: boolean;
  ownerDashboardEnabled?: boolean;
  orderEntryMode?: 'hall' | 'cashier_builder';
  kitchenMode?: 'display' | 'printer' | 'both';
  enabledModules?: string[];
  enabledRoles?: string[];
};

type LegacySessionPayload = Omit<PosSessionPayload, 'user' | 'featureConfig'> & {
  user: SessionCompatUser;
  restaurant_context?: PosRestaurantContext | null;
  restaurantContext?: PosRestaurantContext | null;
  feature_config?: LegacyFeatureConfig | null;
  featureConfig?: SessionCompatFeatureConfig | null;
};

export function normalizeSessionPayload(
  payload: PosSessionPayload | LegacySessionPayload | null,
): PosSessionPayload | null {
  if (!payload) {
    return null;
  }

  const rawUser = payload.user as SessionCompatUser;
  const rawFeatureConfig =
    (payload as LegacySessionPayload).featureConfig ?? (payload as LegacySessionPayload).feature_config;
  const rawRestaurantContext =
    (payload as LegacySessionPayload).restaurantContext ?? (payload as LegacySessionPayload).restaurant_context ?? null;

  const normalizedFeatureConfig: PosFeatureConfig = rawFeatureConfig
    ? {
        id: rawFeatureConfig.id,
        hallEnabled: rawFeatureConfig.hallEnabled ?? rawFeatureConfig.hall_enabled ?? false,
        kitchenEnabled: rawFeatureConfig.kitchenEnabled ?? rawFeatureConfig.kitchen_enabled ?? false,
        cashierEnabled: rawFeatureConfig.cashierEnabled ?? rawFeatureConfig.cashier_enabled ?? false,
        ownerDashboardEnabled:
          rawFeatureConfig.ownerDashboardEnabled ?? rawFeatureConfig.owner_dashboard_enabled ?? false,
        orderEntryMode: rawFeatureConfig.orderEntryMode ?? rawFeatureConfig.order_entry_mode ?? 'hall',
        kitchenMode: rawFeatureConfig.kitchenMode ?? rawFeatureConfig.kitchen_mode ?? 'display',
        enabledModules: rawFeatureConfig.enabledModules ?? rawFeatureConfig.enabled_modules ?? [],
        enabledRoles: rawFeatureConfig.enabledRoles ?? rawFeatureConfig.enabled_roles ?? [],
      }
    : null;

  return {
    token: payload.token,
    user: {
      id: rawUser.id,
      username: rawUser.username,
      fullName: rawUser.fullName ?? rawUser.full_name ?? '',
      permissionCodes: rawUser.permissionCodes ?? rawUser.permission_codes ?? [],
      ...(rawUser.restaurantAccessActive !== undefined
        ? { restaurantAccessActive: rawUser.restaurantAccessActive }
        : {}),
      ...(rawUser.role ? { role: rawUser.role } : {}),
    },
    featureConfig: normalizedFeatureConfig,
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
