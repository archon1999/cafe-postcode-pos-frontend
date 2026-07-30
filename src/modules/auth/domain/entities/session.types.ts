import type { PosThemeColor, PosThemeMode } from 'app/theme';
import type { PosLocale } from 'shared/locale/copy';

export type PosUser = {
  id: string;
  username: string;
  fullName: string;
  restaurantAccessActive?: boolean;
  permissionCodes: string[];
  role?: {
    id: string;
    name: string;
  } | null;
};

export type PosTariff = {
  id: string;
  name: string;
  permissionCodes: string[];
  roleCodes: string[];
} | null;

export type PosSessionPayload = {
  token: string;
  user: PosUser;
  restaurantAccessActive?: boolean;
  roleCodes?: string[];
  tariff?: PosTariff;
  restaurantContext?: PosRestaurantContext | null;
};

export type PosLoginPayload = {
  restaurantId: string;
  pin: string;
};

export type PosRestaurantCodePayload = {
  code: string;
};

export type PosRestaurantContext = {
  restaurantId: string;
  restaurantName: string;
  phone?: string;
  social?: string;
  address?: string;
  posAuthBackgroundImageUrl?: string | null;
  serviceFeeEnabled?: boolean;
  serviceFeePercent?: number | string;
  vatEnabled?: boolean;
  vatPercent?: number | string;
  markingCheckEnabled?: boolean;
  posMonitorVariant?: 'default' | 'light_compact';
  coordinator?: {
    restaurantId: string;
    edgeToken: string;
    coordinatorUrls?: string[];
  } | null;
};

export type PosSessionContextValue = {
  session: PosSessionPayload | null;
  setSession: (value: PosSessionPayload | null) => void;
  isAuthenticated: boolean;
  restaurantContext: PosRestaurantContext | null;
  setRestaurantContext: (value: PosRestaurantContext | null) => void;
  themeMode: PosThemeMode;
  setThemeMode: (mode: PosThemeMode) => void;
  themeColor: PosThemeColor;
  setThemeColor: (color: PosThemeColor) => void;
  locale: PosLocale;
  setLocale: (locale: PosLocale) => void;
};
