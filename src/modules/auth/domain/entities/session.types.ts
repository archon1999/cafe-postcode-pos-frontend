import type { PosThemeMode } from 'app/theme';
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

export type PosFeatureConfig = {
  id: string;
  hallEnabled: boolean;
  kitchenEnabled: boolean;
  cashierEnabled: boolean;
  ownerDashboardEnabled: boolean;
  orderEntryMode: 'hall' | 'cashier_builder';
  kitchenMode: 'display' | 'printer' | 'both';
  enabledModules: string[];
  enabledRoles: string[];
  allowedRoleCodes?: string[];
  allowedPermissionCodes?: string[];
  restaurantAccessActive?: boolean;
} | null;

export type PosSessionPayload = {
  token: string;
  user: PosUser;
  featureConfig: PosFeatureConfig;
  restaurantAccessActive?: boolean;
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
};

export type PosSessionContextValue = {
  session: PosSessionPayload | null;
  setSession: (value: PosSessionPayload | null) => void;
  isAuthenticated: boolean;
  restaurantContext: PosRestaurantContext | null;
  setRestaurantContext: (value: PosRestaurantContext | null) => void;
  themeMode: PosThemeMode;
  setThemeMode: (mode: PosThemeMode) => void;
  locale: PosLocale;
  setLocale: (locale: PosLocale) => void;
};
