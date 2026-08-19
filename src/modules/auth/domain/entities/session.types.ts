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
  lockedAt?: string | null;
  restaurantAccessActive?: boolean;
  roleCodes?: string[];
  tariff?: PosTariff;
  restaurantContext?: PosRestaurantContext | null;
};

export type PosLoginPayload = {
  pin: string;
};

export type PosUnlockPayload = PosLoginPayload;

export type PosAuthState = 'UNPAIRED' | 'PAIRING' | 'PAIRED_NO_USER' | 'AUTHENTICATED' | 'LOCKED' | 'REVOKED';

export type PosDeviceStatus = 'ACTIVE' | 'REVOKED';

export type PosDevice = {
  id: string;
  type: 'POS_TERMINAL';
  name: string;
  status: PosDeviceStatus;
  leaseExpiresAt: string;
  pairedAt?: string;
  lastSeenAt?: string | null;
};

export type PosDevicePairingStatus = 'PENDING' | 'PAIRED' | 'REJECTED' | 'EXPIRED';

export type PosDevicePairing = {
  id: string;
  pollToken: string;
  claimToken: string;
  displayCode: string;
  expiresAt: string;
  status: PosDevicePairingStatus;
};

export type PosDeviceBinding = {
  device: PosDevice;
  restaurantContext: PosRestaurantContext;
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
  paymentTotalMode?: 'fixed' | 'cashier_editable';
  coordinator?: {
    restaurantId: string;
    coordinatorUrls?: string[];
    agentDeviceId?: string;
    agentSigningPublicKeyAlgorithm?: 'ED25519';
    agentSigningPublicKey?: string;
    agentSigningPublicKeyFingerprint?: string;
  } | null;
};

export type PosSessionContextValue = {
  authState: PosAuthState;
  isBootstrapping: boolean;
  device: PosDevice | null;
  pairing: PosDevicePairing | null;
  session: PosSessionPayload | null;
  setSession: (value: PosSessionPayload | null) => void;
  isAuthenticated: boolean;
  restaurantContext: PosRestaurantContext | null;
  startPairing: () => Promise<void>;
  refreshPairing: () => Promise<void>;
  cancelPairing: () => Promise<void>;
  lockSession: (reason?: 'idle' | 'manual') => Promise<void>;
  unlockSession: (pin: string) => Promise<PosSessionPayload>;
  changeUser: () => Promise<void>;
  retryDeviceConnection: () => Promise<void>;
  forgetRevokedDevice: () => Promise<void>;
  themeMode: PosThemeMode;
  setThemeMode: (mode: PosThemeMode) => void;
  themeColor: PosThemeColor;
  setThemeColor: (color: PosThemeColor) => void;
  locale: PosLocale;
  setLocale: (locale: PosLocale) => void;
};
