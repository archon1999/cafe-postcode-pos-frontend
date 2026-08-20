import type { AxiosRequestConfig } from 'axios';
import axios from 'axios';

import {
  bytesToBase64Url,
  createDeviceProofHeaders,
  createPairingKeyProof,
  createPairingStatusProof,
  sha256Hex,
  type StoredPosDeviceIdentity,
} from 'modules/auth/data-access/device';
import type {
  KitchenItemStatus,
  KitchenMonitorQueue,
  KitchenRepository,
  KitchenTicket,
  KitchenTicketStatus,
  TvMonitorBootstrapResult,
  TvMonitorDevice,
  TvMonitorDeviceRegistration,
  TvMonitorDiagnostic,
  TvMonitorPairingSession,
  TvMonitorPairingStatus,
  TvMonitorRestaurantContext,
} from 'modules/kitchen/domain';
import { resolveRemoteApiBaseUrl } from 'shared/api/apiUrl';
import { apiGet, apiGetRemotePublic, apiPost, apiPostRemotePublic, unwrapCollection } from 'shared/api/client';

import { mapKitchenMonitorQueue, mapKitchenTickets } from '../mappers';
import {
  clearStoredTvMonitorIdentity,
  persistTvMonitorIdentity,
  readStoredTvMonitorIdentity,
  type StoredTvMonitorIdentity,
} from '../storage/tv-monitor-identity.store';
import {
  clearTvMonitorBrowserRegistration,
  persistTvMonitorDevice,
  readLegacyTvMonitorCredential,
} from '../storage/tv-monitor.storage';

type CollectionPayload<T> = T[] | { data?: T[] };

type DeviceBindingResponse = {
  device: TvMonitorDevice;
  restaurantContext: TvMonitorRestaurantContext;
};

type PairingApiResponse = Partial<TvMonitorPairingSession> & {
  claimToken?: string;
  status: string;
  device?: TvMonitorDevice;
  restaurantContext?: TvMonitorRestaurantContext;
};

const DEVICE_RECOVERY_CODES = new Set([
  'device_required',
  'device_revoked',
  'device_lease_expired',
  'device_proof_invalid',
]);
const TERMINAL_LEGACY_MIGRATION_STATUSES = new Set([400, 401, 403, 404, 409, 410]);
const LEASE_RENEW_LEAD_MS = 10 * 60_000;

function cryptoApi() {
  const value = globalThis.crypto;
  if (!value?.subtle || typeof value.getRandomValues !== 'function') {
    throw new Error('TV’ni xavfsiz ulash uchun Web Crypto mavjud emas. HTTPS orqali oching.');
  }
  return value;
}

function detectedPlatform() {
  return (
    (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ||
    navigator.platform ||
    'web'
  );
}

async function createTvMonitorIdentity() {
  const keys = await cryptoApi().subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
  const publicKeyBytes = new Uint8Array(await cryptoApi().subtle.exportKey('spki', keys.publicKey));
  const platform = detectedPlatform();
  return persistTvMonitorIdentity({
    privateKey: keys.privateKey,
    publicKey: bytesToBase64Url(publicKeyBytes),
    publicKeyFingerprint: await sha256Hex(publicKeyBytes),
    deviceName: `${platform} Kitchen TV`,
    platform,
    appVersion: String(import.meta.env.VITE_APP_VERSION || 'web'),
    createdAt: new Date().toISOString(),
  });
}

function proofIdentity(identity: StoredTvMonitorIdentity): StoredPosDeviceIdentity {
  return {
    storageKey: 'primary',
    schemaVersion: 1,
    privateKey: identity.privateKey,
    publicKey: identity.publicKey,
    publicKeyFingerprint: identity.publicKeyFingerprint,
    deviceName: identity.deviceName,
    platform: identity.platform,
    appVersion: identity.appVersion,
    createdAt: identity.createdAt,
  };
}

async function identityForPairing() {
  const stored = await readStoredTvMonitorIdentity();
  if (stored?.privateKey && !stored.device) return stored;
  return createTvMonitorIdentity();
}

function registrationFromBinding(response: DeviceBindingResponse): TvMonitorDeviceRegistration {
  const { device, restaurantContext } = response;
  if (
    !device?.id ||
    device.type !== 'TV_MONITOR' ||
    (device.status !== 'ACTIVE' && device.status !== 'REVOKED') ||
    !device.leaseExpiresAt ||
    !restaurantContext?.restaurantId ||
    !restaurantContext.restaurantName
  ) {
    throw new Error('Server TV qurilma va restoran ma’lumotini to‘liq qaytarmadi.');
  }
  return {
    deviceId: device.id,
    deviceStatus: device.status,
    leaseExpiresAt: device.leaseExpiresAt,
    restaurantId: restaurantContext.restaurantId,
    restaurantName: restaurantContext.restaurantName,
    ...(restaurantContext.posMonitorVariant ? { posMonitorVariant: restaurantContext.posMonitorVariant } : {}),
  };
}

async function persistBinding(identity: StoredTvMonitorIdentity, response: DeviceBindingResponse) {
  const registration = registrationFromBinding(response);
  await persistTvMonitorIdentity({
    ...identity,
    device: response.device,
    restaurantContext: response.restaurantContext,
    pairing: undefined,
  });
  // This overwrites both browser and Android bridge storage with a strict
  // metadata-only payload, removing the legacy bearer credential immediately.
  persistTvMonitorDevice(registration);
  return registration;
}

function pairingStatus(value: string): TvMonitorPairingSession['status'] | 'paired' {
  const normalized = value.toLowerCase();
  if (normalized === 'paired' || normalized === 'rejected' || normalized === 'expired') return normalized;
  return 'pending';
}

function safeClaimUrl(response: PairingApiResponse, pairingId: string) {
  if (!response.claimUrl || !response.claimToken) {
    throw new Error('Server QR ulash ma’lumotini to‘liq qaytarmadi.');
  }
  const url = new URL(response.claimUrl, window.location.origin);
  const trustedUrl = new URL(
    String(import.meta.env.VITE_CONTROL_APP_URL || 'https://control.cafe-postcode.uz'),
  );
  const basePath = trustedUrl.pathname.replace(/\/+$/, '');
  trustedUrl.pathname = `${basePath.endsWith('/control') ? basePath : `${basePath}/control`}/pair`;
  const fragment = new URLSearchParams(url.hash.replace(/^#/, ''));
  const isLoopback = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  if (
    (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLoopback)) ||
    url.origin !== trustedUrl.origin ||
    url.pathname !== trustedUrl.pathname ||
    url.username ||
    url.password ||
    url.search ||
    fragment.get('v') !== '1' ||
    fragment.get('pairingId') !== pairingId ||
    fragment.get('claimToken') !== response.claimToken
  ) {
    throw new Error('Server xavfsiz fragmentli QR manzilini qaytarmadi.');
  }
  return url.toString();
}

function pairingFromResponse(response: PairingApiResponse): TvMonitorPairingSession {
  if (
    !response.id ||
    !response.pollToken ||
    !response.displayCode ||
    !response.expiresAt ||
    !response.qrPath ||
    !response.qrSize ||
    response.qrSize < 21
  ) {
    throw new Error('Server TV ulash ma’lumotini to‘liq qaytarmadi.');
  }
  const status = pairingStatus(response.status);
  return {
    id: response.id,
    pollToken: response.pollToken,
    claimUrl: safeClaimUrl(response, response.id),
    qrPath: response.qrPath,
    qrSize: response.qrSize,
    displayCode: response.displayCode,
    expiresAt: response.expiresAt,
    status: status === 'paired' ? 'pending' : status,
  };
}

function cachedRegistration(identity: StoredTvMonitorIdentity) {
  if (!identity.device || !identity.restaurantContext) return null;
  return registrationFromBinding({ device: identity.device, restaurantContext: identity.restaurantContext });
}

function responseCode(error: unknown) {
  if (!axios.isAxiosError(error)) return '';
  const payload = error.response?.data as { code?: unknown } | undefined;
  return typeof payload?.code === 'string' ? payload.code : '';
}

async function signedConfig(identity: StoredTvMonitorIdentity, url: string, method: 'GET' | 'POST', data?: unknown) {
  if (!identity.device?.id) throw new Error('Ulangan TV qurilma kaliti topilmadi.');
  const config: AxiosRequestConfig = {
    baseURL: resolveRemoteApiBaseUrl(),
    url,
    method,
    ...(data === undefined ? {} : { data }),
  };
  const proof = await createDeviceProofHeaders(config, proofIdentity(identity), identity.device.id);
  if (!proof) throw new Error('TV qurilma proofini yaratib bo‘lmadi.');
  return proof;
}

async function signedGet<T>(identity: StoredTvMonitorIdentity, url: string) {
  const proof = await signedConfig(identity, url, 'GET');
  return apiGetRemotePublic<T>(url, { headers: proof.headers });
}

async function signedPost<T>(identity: StoredTvMonitorIdentity, url: string, payload: unknown) {
  const proof = await signedConfig(identity, url, 'POST', payload);
  return apiPostRemotePublic<T>(url, proof.wireData, { headers: proof.headers });
}

async function restoreBinding(identity: StoredTvMonitorIdentity) {
  if (!identity.device) throw new Error('Ulangan TV qurilmasi topilmadi.');
  const leaseExpiresAt = Date.parse(identity.device.leaseExpiresAt);
  let current = identity;
  if (!Number.isFinite(leaseExpiresAt) || leaseExpiresAt <= Date.now() + LEASE_RENEW_LEAD_MS) {
    const renewed = await signedPost<{ device: TvMonitorDevice; leaseExpiresAt: string }>(
      current,
      '/devices/lease/renew/',
      {},
    );
    current = await persistTvMonitorIdentity({
      ...current,
      device: { ...current.device, ...renewed.device, leaseExpiresAt: renewed.leaseExpiresAt },
    });
  }
  const response = await signedGet<DeviceBindingResponse>(current, '/devices/me/');
  return persistBinding(current, response);
}

async function migrateLegacyCredential(identity: StoredTvMonitorIdentity, token: string) {
  const keyProof = await createPairingKeyProof(proofIdentity(identity));
  const response = await apiPostRemotePublic<DeviceBindingResponse>(
    '/devices/legacy-tv-migration/',
    {
      name: identity.deviceName,
      platform: identity.platform,
      appVersion: identity.appVersion,
      publicKeyAlgorithm: 'P256_SHA256',
      publicKey: identity.publicKey,
      keyProof,
    },
    { headers: { 'X-TV-Token': token } },
  );
  return persistBinding(identity, response);
}

class KitchenRepositoryImpl implements KitchenRepository {
  async getQueue(): Promise<KitchenTicket[]> {
    return mapKitchenTickets(unwrapCollection(await apiGet<CollectionPayload<KitchenTicket>>('/pos/kitchen/queue/')));
  }

  async getMonitorQueue(restaurantId: string): Promise<KitchenMonitorQueue> {
    const params = new URLSearchParams({ restaurant_id: restaurantId });
    return mapKitchenMonitorQueue(await apiGet<KitchenMonitorQueue>(`/pos/monitor/kitchen-queue/?${params}`));
  }

  async bootstrapTvMonitor(): Promise<TvMonitorBootstrapResult> {
    let identity = await readStoredTvMonitorIdentity();
    if (identity?.device) {
      if (identity.device.status === 'REVOKED') {
        await this.forgetTvMonitorDevice();
        identity = null;
      } else {
        try {
          return { status: 'paired', device: await restoreBinding(identity) };
        } catch (error) {
          if (DEVICE_RECOVERY_CODES.has(responseCode(error))) {
            await this.forgetTvMonitorDevice();
            identity = null;
          } else {
            const cached = cachedRegistration(identity);
            if (cached) {
              persistTvMonitorDevice(cached);
              return { status: 'paired', device: cached };
            }
            throw error;
          }
        }
      }
    }

    const legacyCredential = readLegacyTvMonitorCredential();
    if (legacyCredential) {
      identity ??= await identityForPairing();
      try {
        return { status: 'paired', device: await migrateLegacyCredential(identity, legacyCredential.token) };
      } catch (error) {
        if (!axios.isAxiosError(error) || !TERMINAL_LEGACY_MIGRATION_STATUSES.has(error.response?.status ?? 0)) {
          throw error;
        }
        // Invalid/retired legacy bearer values must not survive in either
        // browser storage or the Android bridge. The existing P-256 key can
        // safely continue into a fresh admin-approved pairing.
        clearTvMonitorBrowserRegistration();
      }
    }

    identity ??= await readStoredTvMonitorIdentity();
    const pairing = identity?.pairing;
    if (pairing?.status === 'pending' && Date.parse(pairing.expiresAt) > Date.now()) {
      return { status: 'pairing', pairing };
    }
    if (identity?.pairing) await persistTvMonitorIdentity({ ...identity, pairing: undefined });
    return { status: 'unpaired' };
  }

  async createTvMonitorPairing(): Promise<TvMonitorPairingSession> {
    const identity = await identityForPairing();
    if (identity.pairing?.status === 'pending' && Date.parse(identity.pairing.expiresAt) > Date.now()) {
      return identity.pairing;
    }
    const keyProof = await createPairingKeyProof(proofIdentity(identity));
    const response = await apiPostRemotePublic<PairingApiResponse>('/devices/pairings/', {
      deviceType: 'TV_MONITOR',
      name: identity.deviceName,
      platform: identity.platform,
      appVersion: identity.appVersion,
      publicKeyAlgorithm: 'P256_SHA256',
      publicKey: identity.publicKey,
      keyProof,
    });
    const pairing = pairingFromResponse(response);
    await persistTvMonitorIdentity({ ...identity, pairing });
    return pairing;
  }

  async getTvMonitorPairingStatus(pairingId: string, pollToken: string): Promise<TvMonitorPairingStatus> {
    const identity = await readStoredTvMonitorIdentity();
    if (!identity?.pairing || identity.pairing.id !== pairingId || identity.pairing.pollToken !== pollToken) {
      throw new Error('TV ulash sessiyasi topilmadi.');
    }
    try {
      const proof = await createPairingStatusProof(proofIdentity(identity), pairingId, pollToken);
      const response = await apiPostRemotePublic<PairingApiResponse>(`/devices/pairings/${pairingId}/status/`, {
        pollToken,
        ...proof,
      });
      const status = pairingStatus(response.status);
      if (status === 'paired' && response.device && response.restaurantContext) {
        await persistBinding(identity, response as DeviceBindingResponse);
        return { status: 'paired', device: response.device, restaurantContext: response.restaurantContext };
      }
      if (status === 'rejected' || status === 'expired') {
        await persistTvMonitorIdentity({ ...identity, pairing: { ...identity.pairing, status } });
        return { status };
      }
      const expiresAt = response.expiresAt || identity.pairing.expiresAt;
      await persistTvMonitorIdentity({
        ...identity,
        pairing: { ...identity.pairing, status: 'pending', expiresAt },
      });
      return { status: 'pending', expiresAt };
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 410) {
        await persistTvMonitorIdentity({ ...identity, pairing: { ...identity.pairing, status: 'expired' } });
        return { status: 'expired' };
      }
      throw error;
    }
  }

  async getTvMonitorQueue(): Promise<KitchenMonitorQueue> {
    const identity = await readStoredTvMonitorIdentity();
    if (!identity?.device) throw new Error('Ulangan TV qurilmasi topilmadi.');
    return mapKitchenMonitorQueue(await signedGet<KitchenMonitorQueue>(identity, '/pos/monitor/tv-kitchen-queue/'));
  }

  async reportTvMonitorDiagnostic(diagnostic: TvMonitorDiagnostic): Promise<void> {
    const identity = await readStoredTvMonitorIdentity();
    if (!identity?.device) throw new Error('Ulangan TV qurilmasi topilmadi.');
    await signedPost(identity, '/pos/monitor/tv-diagnostics/', diagnostic);
  }

  async forgetTvMonitorDevice(): Promise<void> {
    clearTvMonitorBrowserRegistration();
    await clearStoredTvMonitorIdentity();
  }

  async replayTicketAnnouncement(ticketId: string): Promise<void> {
    await apiPost(`/pos/kitchen/tickets/${ticketId}/announce/`, {});
  }

  async updateTicketStatus(ticketId: string, status: KitchenTicketStatus) {
    await apiPost(`/pos/kitchen/tickets/${ticketId}/status/`, { status });
  }

  async updateItemStatus(itemId: string, status: KitchenItemStatus) {
    await apiPost(`/pos/kitchen/items/${itemId}/status/`, { status });
  }
}

export const kitchenRepository: KitchenRepository = new KitchenRepositoryImpl();
