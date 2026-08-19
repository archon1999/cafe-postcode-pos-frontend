import axios from 'axios';

import type {
  AuthRepository,
  PosDevice,
  PosDeviceBinding,
  PosDevicePairing,
  PosLoginPayload,
  PosRestaurantContext,
  PosSessionPayload,
  PosUnlockPayload,
} from 'modules/auth/domain';
import { apiGetRemote, apiPost, apiPostRemote, apiPostRemotePublic } from 'shared/api/client';
import {
  readLegacyEdgeMigrationCredential,
  readOrCreateEdgeTerminalIdentity,
  readTransportConnection,
} from 'shared/api/edgeConnection';
import { secureLocalJSONRequest } from 'shared/api/edgeSecureChannel';

import {
  clearStoredDeviceIdentity,
  createPairingKeyProof,
  createPairingStatusProof,
  createPosDeviceIdentity,
  persistDeviceIdentity,
  readStoredDeviceIdentity,
  updateStoredDeviceIdentity,
  type StoredPosDeviceIdentity,
} from '../device';
import {
  clearLegacyRestaurantContext,
  normalizeRestaurantContext,
  normalizeSessionPayload,
  readStoredRestaurantContext,
} from '../storage/session.storage';

type PairingResponse = {
  id?: string;
  pollToken?: string;
  claimToken?: string;
  displayCode?: string;
  expiresAt?: string;
  status: string;
  device?: PosDevice;
  restaurantContext?: PosRestaurantContext;
};

type DeviceBindingResponse = {
  device: PosDevice;
  restaurantContext: PosRestaurantContext;
};

type LocalAgentAttestation = {
  version: 'v1';
  restaurantId: string;
  localAgentDeviceId: string;
  terminalId: string;
  publicKeyFingerprint: string;
  issuedAt: string | number;
  expiresAt: string | number;
  nonce: string;
  signature: string;
};

export class PosAuthApiError extends Error {
  readonly code: string | null;
  readonly status: number | null;

  constructor(message: string, code: string | null = null, status: number | null = null) {
    super(message);
    this.name = 'PosAuthApiError';
    this.code = code;
    this.status = status;
  }
}

function extractErrorMessage(payload: unknown): string | null {
  if (typeof payload === 'string') {
    const message = payload.trim();
    if (!message || message.length > 500) return null;
    if (/^\s*<(?:!doctype|html|head|body)\b/i.test(message)) return null;
    return message;
  }
  if (Array.isArray(payload)) {
    for (const item of payload) {
      const message = extractErrorMessage(item);
      if (message) return message;
    }
    return null;
  }
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    for (const key of ['pin', 'detail', 'nonFieldErrors', 'non_field_errors', 'message']) {
      const message = extractErrorMessage(record[key]);
      if (message) return message;
    }
    for (const value of Object.values(record)) {
      const message = extractErrorMessage(value);
      if (message) return message;
    }
  }
  return null;
}

function normalizeError(error: unknown, fallback: string) {
  if (!axios.isAxiosError(error)) return error;
  const response = error.response?.data as { code?: unknown } | undefined;
  const code = typeof response?.code === 'string' ? response.code : null;
  return new PosAuthApiError(
    extractErrorMessage(error.response?.data) || fallback,
    code,
    error.response?.status ?? null,
  );
}

function normalizePairingStatus(value: string): PosDevicePairing['status'] {
  const status = value.toUpperCase();
  if (status === 'PAIRED' || status === 'REJECTED' || status === 'EXPIRED') return status;
  return 'PENDING';
}

function pairingFromResponse(response: PairingResponse, fallback?: PosDevicePairing): PosDevicePairing {
  const id = response.id ?? fallback?.id;
  const pollToken = response.pollToken ?? fallback?.pollToken;
  const claimToken = response.claimToken ?? fallback?.claimToken;
  const displayCode = response.displayCode ?? fallback?.displayCode;
  const expiresAt = response.expiresAt ?? fallback?.expiresAt;
  if (!id || !pollToken || !claimToken || !displayCode || !expiresAt) {
    throw new Error('Server ulash ma’lumotini to‘liq qaytarmadi.');
  }
  return {
    id,
    pollToken,
    claimToken,
    displayCode,
    expiresAt,
    status: normalizePairingStatus(response.status),
  };
}

function bindingFromResponse(response: DeviceBindingResponse): PosDeviceBinding {
  const restaurantContext = normalizeRestaurantContext(response.restaurantContext);
  if (!response.device?.id || !restaurantContext?.restaurantId) {
    throw new Error('Server qurilma va restoran ma’lumotini to‘liq qaytarmadi.');
  }
  return { device: response.device, restaurantContext };
}

async function persistBinding(identity: StoredPosDeviceIdentity, response: DeviceBindingResponse) {
  const binding = bindingFromResponse(response);
  await persistDeviceIdentity({
    ...identity,
    device: binding.device,
    restaurantContext: binding.restaurantContext,
    pairing: undefined,
  });
  clearLegacyRestaurantContext();
  return binding;
}

async function identityForPairing() {
  const stored = await readStoredDeviceIdentity();
  if (stored?.privateKey && !stored.device) return stored;
  const created = await createPosDeviceIdentity();
  return persistDeviceIdentity(created);
}

async function requestLocalAgentAttestation(identity: StoredPosDeviceIdentity) {
  const connection = readTransportConnection();
  const legacyMigrationCredential = readLegacyEdgeMigrationCredential();
  if (!connection || connection.mode === 'remote' || !connection.origin) return null;

  const keyProof = await createPairingKeyProof(identity);
  const response = await secureLocalJSONRequest<LocalAgentAttestation>(
    connection.origin,
    '/v1/pos/devices/migration-attestation',
    {
      terminalId: readOrCreateEdgeTerminalIdentity().terminalId,
      publicKeyAlgorithm: 'P256_SHA256',
      publicKey: identity.publicKey,
      deviceName: identity.deviceName,
      platform: identity.platform,
      keyProof,
    },
    legacyMigrationCredential,
  );
  return response?.ok ? response.data : null;
}

class PosAuthRepositoryImpl implements AuthRepository {
  async createDevicePairing(): Promise<PosDevicePairing> {
    try {
      const identity = await identityForPairing();
      const keyProof = await createPairingKeyProof(identity);
      const response = await apiPostRemotePublic<PairingResponse>('/devices/pairings/', {
        deviceType: 'POS_TERMINAL',
        name: identity.deviceName,
        platform: identity.platform,
        appVersion: identity.appVersion,
        publicKeyAlgorithm: 'P256_SHA256',
        publicKey: identity.publicKey,
        keyProof,
      });
      const pairing = pairingFromResponse(response);
      await persistDeviceIdentity({ ...identity, pairing });
      return pairing;
    } catch (error) {
      throw normalizeError(error, 'Qurilmani ulash so‘rovini yaratib bo‘lmadi.');
    }
  }

  async readDevicePairingStatus(): Promise<PosDevicePairing | PosDeviceBinding> {
    const identity = await readStoredDeviceIdentity();
    if (!identity?.pairing) throw new Error('Aktiv ulash so‘rovi topilmadi.');
    try {
      const { id, pollToken } = identity.pairing;
      const proof = await createPairingStatusProof(identity, id, pollToken);
      const response = await apiPostRemotePublic<PairingResponse>(`/devices/pairings/${id}/status/`, {
        pollToken,
        ...proof,
      });
      if (normalizePairingStatus(response.status) === 'PAIRED' && response.device && response.restaurantContext) {
        return persistBinding(identity, response as DeviceBindingResponse);
      }
      const pairing = {
        ...identity.pairing,
        ...pairingFromResponse(response, identity.pairing),
      };
      await persistDeviceIdentity({ ...identity, pairing });
      return pairing;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 410) {
        const pairing = { ...identity.pairing, status: 'EXPIRED' as const };
        await persistDeviceIdentity({ ...identity, pairing });
        return pairing;
      }
      throw normalizeError(error, 'Qurilma ulanish holatini tekshirib bo‘lmadi.');
    }
  }

  async restoreDeviceBinding(): Promise<PosDeviceBinding> {
    const identity = await readStoredDeviceIdentity();
    if (!identity?.device) throw new PosAuthApiError('Qurilma hali ulanmagan.', 'device_required', 401);
    if (identity.device.status === 'REVOKED') {
      throw new PosAuthApiError('Qurilma superadmin tomonidan bekor qilingan.', 'device_revoked', 401);
    }

    try {
      const leaseExpiresAt = Date.parse(identity.device.leaseExpiresAt);
      if (!Number.isFinite(leaseExpiresAt) || leaseExpiresAt <= Date.now() + 10 * 60_000) {
        const lease = await apiPostRemote<{ leaseExpiresAt: string }>('/devices/lease/renew/', {});
        await updateStoredDeviceIdentity((current) => ({
          ...current,
          device: current.device ? { ...current.device, leaseExpiresAt: lease.leaseExpiresAt } : current.device,
        }));
      }
      const response = await apiGetRemote<DeviceBindingResponse>('/devices/me/');
      return persistBinding((await readStoredDeviceIdentity()) ?? identity, response);
    } catch (error) {
      const normalized = normalizeError(error, 'Qurilma ulanishini tekshirib bo‘lmadi.');
      if (
        normalized instanceof PosAuthApiError &&
        ['device_revoked', 'device_required', 'device_lease_expired', 'device_proof_invalid'].includes(
          normalized.code || '',
        )
      ) {
        if (normalized.code === 'device_revoked') {
          await updateStoredDeviceIdentity((current) => ({
            ...current,
            device: current.device ? { ...current.device, status: 'REVOKED' } : current.device,
          }));
        }
        throw normalized;
      }

      const transport = readTransportConnection();
      if (
        transport &&
        transport.mode !== 'remote' &&
        identity.restaurantContext?.restaurantId === transport.restaurantId
      ) {
        return { device: identity.device, restaurantContext: identity.restaurantContext };
      }
      throw normalized;
    }
  }

  async tryLegacyDeviceMigration(): Promise<PosDeviceBinding | null> {
    const legacyRestaurant = readStoredRestaurantContext();

    const identity = await identityForPairing();
    try {
      const agentAttestation = await requestLocalAgentAttestation(identity);
      if (
        !agentAttestation ||
        (legacyRestaurant?.restaurantId && agentAttestation.restaurantId !== legacyRestaurant.restaurantId) ||
        agentAttestation.publicKeyFingerprint !== identity.publicKeyFingerprint
      ) {
        return null;
      }
      const keyProof = await createPairingKeyProof(identity);
      const response = await apiPostRemotePublic<DeviceBindingResponse>('/devices/legacy-pos-migration/', {
        deviceType: 'POS_TERMINAL',
        name: identity.deviceName,
        platform: identity.platform,
        appVersion: identity.appVersion,
        publicKeyAlgorithm: 'P256_SHA256',
        publicKey: identity.publicKey,
        keyProof,
        agentAttestation,
      });
      return persistBinding((await readStoredDeviceIdentity()) ?? identity, response);
    } catch (error) {
      const normalized = normalizeError(error, 'Mavjud terminalni avtomatik ulab bo‘lmadi.');
      if (normalized instanceof PosAuthApiError && [400, 401, 403, 404, 409, 410].includes(normalized.status || 0)) {
        return null;
      }
      throw normalized;
    }
  }

  async clearDeviceIdentity() {
    await clearStoredDeviceIdentity();
    clearLegacyRestaurantContext();
  }

  async loginWithPin(payload: PosLoginPayload): Promise<PosSessionPayload> {
    try {
      const session = normalizeSessionPayload(await apiPost<PosSessionPayload>('/pos/auth/pin-login/', payload));
      if (!session) throw new Error('PIN login did not return a session');
      return session;
    } catch (error) {
      throw normalizeError(error, 'PIN orqali kirib bo‘lmadi.');
    }
  }

  async lockSession() {
    try {
      await apiPost('/pos/auth/lock/', {});
    } catch (error) {
      throw normalizeError(error, 'Sessiyani qulflab bo‘lmadi.');
    }
  }

  async unlockSession(payload: PosUnlockPayload): Promise<PosSessionPayload> {
    try {
      const session = normalizeSessionPayload(await apiPost<PosSessionPayload>('/pos/auth/unlock/', payload));
      if (!session) throw new Error('PIN unlock did not return a session');
      return session;
    } catch (error) {
      throw normalizeError(error, 'PIN orqali qulfni ochib bo‘lmadi.');
    }
  }

  async logoutSession() {
    try {
      await apiPost('/pos/auth/logout/', {});
    } catch (error) {
      throw normalizeError(error, 'Sessiyadan chiqib bo‘lmadi.');
    }
  }
}

export const authRepository: AuthRepository = new PosAuthRepositoryImpl();
