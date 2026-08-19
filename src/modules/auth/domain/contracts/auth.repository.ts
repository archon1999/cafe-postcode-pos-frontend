import type {
  PosDeviceBinding,
  PosDevicePairing,
  PosLoginPayload,
  PosSessionPayload,
  PosUnlockPayload,
} from '../entities';

export interface AuthRepository {
  createDevicePairing(): Promise<PosDevicePairing>;
  readDevicePairingStatus(): Promise<PosDevicePairing | PosDeviceBinding>;
  restoreDeviceBinding(): Promise<PosDeviceBinding>;
  tryLegacyDeviceMigration(): Promise<PosDeviceBinding | null>;
  clearDeviceIdentity(): Promise<void>;
  loginWithPin(payload: PosLoginPayload): Promise<PosSessionPayload>;
  lockSession(): Promise<void>;
  unlockSession(payload: PosUnlockPayload): Promise<PosSessionPayload>;
  logoutSession(): Promise<void>;
}
