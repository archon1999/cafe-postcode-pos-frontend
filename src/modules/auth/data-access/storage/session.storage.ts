import { DEFAULT_POS_THEME_COLOR, isPosThemeColor, type PosThemeColor, type PosThemeMode } from 'app/theme';
import type { PosRestaurantContext, PosSessionPayload, PosTariff, PosUser } from 'modules/auth/domain';
import type { PosLocale } from 'shared/locale/copy';

const STORAGE_KEY = 'restaurant-pos-session';
const RESTAURANT_CONTEXT_KEY = 'restaurant-pos-context';
const THEME_KEY = 'restaurant-pos-theme-mode';
const THEME_COLOR_KEY = 'restaurant-pos-theme-color';
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

type RestaurantContextCompat = PosRestaurantContext & {
  restaurant_id?: string;
  restaurant_name?: string;
  phone?: string;
  social?: string;
  address?: string;
  pos_auth_background_image_url?: string | null;
  service_fee_enabled?: boolean;
  service_fee_percent?: number | string;
  vat_enabled?: boolean;
  vat_percent?: number | string;
  marking_check_enabled?: boolean;
};

type LegacySessionPayload = Omit<PosSessionPayload, 'user' | 'tariff' | 'roleCodes'> & {
  user: SessionCompatUser;
  restaurant_context?: RestaurantContextCompat | null;
  restaurantContext?: PosRestaurantContext | null;
  restaurant_access_active?: boolean;
  restaurantAccessActive?: boolean;
  role_codes?: string[];
  roleCodes?: string[];
  tariff?: SessionCompatTariff | null;
};

function normalizeRestaurantContext(rawContext: RestaurantContextCompat | PosRestaurantContext | null) {
  if (!rawContext) {
    return null;
  }

  const context: PosRestaurantContext = {
    restaurantId: rawContext.restaurantId ?? (rawContext as RestaurantContextCompat).restaurant_id ?? '',
    restaurantName: rawContext.restaurantName ?? (rawContext as RestaurantContextCompat).restaurant_name ?? '',
  };
  const phone = rawContext.phone ?? (rawContext as RestaurantContextCompat).phone;
  const social = rawContext.social ?? (rawContext as RestaurantContextCompat).social;
  const address = rawContext.address ?? (rawContext as RestaurantContextCompat).address;
  const backgroundImageUrl =
    rawContext.posAuthBackgroundImageUrl ?? (rawContext as RestaurantContextCompat).pos_auth_background_image_url;
  const serviceFeeEnabled = rawContext.serviceFeeEnabled ?? (rawContext as RestaurantContextCompat).service_fee_enabled;
  const serviceFeePercent = rawContext.serviceFeePercent ?? (rawContext as RestaurantContextCompat).service_fee_percent;
  const vatEnabled = rawContext.vatEnabled ?? (rawContext as RestaurantContextCompat).vat_enabled;
  const vatPercent = rawContext.vatPercent ?? (rawContext as RestaurantContextCompat).vat_percent;
  const markingCheckEnabled =
    rawContext.markingCheckEnabled ?? (rawContext as RestaurantContextCompat).marking_check_enabled;

  if (phone !== undefined) context.phone = phone;
  if (social !== undefined) context.social = social;
  if (address !== undefined) context.address = address;
  if (backgroundImageUrl !== undefined) context.posAuthBackgroundImageUrl = backgroundImageUrl;
  if (serviceFeeEnabled !== undefined) context.serviceFeeEnabled = serviceFeeEnabled;
  if (serviceFeePercent !== undefined) context.serviceFeePercent = serviceFeePercent;
  if (vatEnabled !== undefined) context.vatEnabled = vatEnabled;
  if (vatPercent !== undefined) context.vatPercent = vatPercent;
  if (markingCheckEnabled !== undefined) context.markingCheckEnabled = markingCheckEnabled;

  return context;
}

export function normalizeSessionPayload(
  payload: PosSessionPayload | LegacySessionPayload | null,
): PosSessionPayload | null {
  if (!payload) {
    return null;
  }

  const rawUser = payload.user as SessionCompatUser;
  const rawRestaurantContext =
    (payload as LegacySessionPayload).restaurantContext ?? (payload as LegacySessionPayload).restaurant_context ?? null;
  const restaurantContext = normalizeRestaurantContext(rawRestaurantContext);
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
    ...(restaurantContext ? { restaurantContext } : {}),
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
  const rawValue = sessionStorage.getItem(STORAGE_KEY);
  if (!rawValue) return null;
  try {
    return normalizeSessionPayload(JSON.parse(rawValue) as LegacySessionPayload);
  } catch {
    sessionStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function persistSession(value: PosSessionPayload | null) {
  const normalizedValue = normalizeSessionPayload(value);

  if (normalizedValue) {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(normalizedValue));
    localStorage.removeItem(STORAGE_KEY);
  } else {
    sessionStorage.removeItem(STORAGE_KEY);
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

export function readStoredThemeColor(): PosThemeColor {
  const rawValue = localStorage.getItem(THEME_COLOR_KEY);

  return isPosThemeColor(rawValue) ? rawValue : DEFAULT_POS_THEME_COLOR;
}

export function persistThemeColor(color: PosThemeColor) {
  localStorage.setItem(THEME_COLOR_KEY, color);
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
