import axios from 'axios';

import {
  readStoredDeviceIdentity,
  updateStoredDeviceIdentity,
} from 'modules/auth/data-access/device/device-identity.store';
import { persistSession, readStoredSession } from 'modules/auth/data-access/storage/session.storage';
import type { PosRestaurantContext } from 'modules/auth/domain';

import { apiPost, apiPostDeviceRemote, apiPostRemote } from './client';
import {
  DEFAULT_EDGE_ORIGIN,
  isLoopbackEdgeOrigin,
  normalizeEdgeOrigin,
  persistTransportConnection,
  readLegacyEdgeMigrationCredential,
  readOrCreateEdgeTerminalIdentity,
  readTransportConnection,
  type PosTransportConnection,
  type PosTransportMode,
} from './edgeConnection';
import { ensureLocalAgentSecureChannel, readBoundedJSONResponse, type LocalAgentTrust } from './edgeSecureChannel';

export const LOCAL_AGENT_PROTOCOL_VERSION = 1;

type Coordinator = NonNullable<PosRestaurantContext['coordinator']>;
type HealthResponse = { protocolVersion?: number };
type EdgeCandidate = { origin: string; trust?: LocalAgentTrust; secureChannel?: boolean };
type ProbeResult =
  | { status: 'selected'; connection: PosTransportConnection }
  | { status: 'incompatible'; protocolVersion: number }
  | { status: 'unavailable' };

export class LocalAgentCompatibilityError extends Error {
  readonly actualProtocolVersion: number;

  constructor(actualProtocolVersion: number) {
    super(
      `Local Agent protokoli mos emas (agent: ${actualProtocolVersion}, POS: ${LOCAL_AGENT_PROTOCOL_VERSION}). ` +
        'Local Agent va POS versiyalarini birga yangilang.',
    );
    this.name = 'LocalAgentCompatibilityError';
    this.actualProtocolVersion = actualProtocolVersion;
  }
}

function safeNormalizeEdgeOrigin(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    return normalizeEdgeOrigin(value);
  } catch {
    return null;
  }
}

function terminalIdentity() {
  return readOrCreateEdgeTerminalIdentity();
}

async function edgeFetch<T>(origin: string, path: string, init?: RequestInit, timeoutMs = 2_500): Promise<T> {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${normalizeEdgeOrigin(origin)}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    });
    if (!response.ok) throw new Error(`Edge HTTP ${response.status}`);
    return await readBoundedJSONResponse<T>(response, 64 * 1024);
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

async function probe(origin: string, restaurantId: string, trust?: LocalAgentTrust): Promise<ProbeResult> {
  try {
    const health = await edgeFetch<HealthResponse>(origin, '/health');
    const protocolVersion = health.protocolVersion ?? LOCAL_AGENT_PROTOCOL_VERSION;
    if (!Number.isInteger(protocolVersion) || protocolVersion !== LOCAL_AGENT_PROTOCOL_VERSION) {
      return { status: 'incompatible', protocolVersion };
    }
    if (!(await ensureLocalAgentSecureChannel(origin, readLegacyEdgeMigrationCredential(), true, trust, restaurantId)))
      return { status: 'unavailable' };
    return {
      status: 'selected',
      connection: {
        mode: isLoopbackEdgeOrigin(origin) ? 'local' : 'router',
        restaurantId,
        origin: normalizeEdgeOrigin(origin),
        secureChannel: true,
        protocolVersion,
        backendOnline: true,
        selectedAt: new Date().toISOString(),
      },
    };
  } catch {
    return { status: 'unavailable' };
  }
}

function coordinatorTrust(coordinator?: Coordinator | null): LocalAgentTrust | undefined {
  if (
    !coordinator?.restaurantId ||
    !coordinator.agentDeviceId ||
    coordinator.agentSigningPublicKeyAlgorithm !== 'ED25519' ||
    !coordinator.agentSigningPublicKey ||
    !/^[0-9a-f]{64}$/i.test(coordinator.agentSigningPublicKeyFingerprint || '')
  ) {
    return undefined;
  }
  return {
    restaurantId: coordinator.restaurantId,
    terminalId: coordinator.terminalId,
    agentDeviceId: coordinator.agentDeviceId,
    agentSigningPublicKeyAlgorithm: 'ED25519',
    agentSigningPublicKey: coordinator.agentSigningPublicKey,
    agentSigningPublicKeyFingerprint: coordinator.agentSigningPublicKeyFingerprint!,
  };
}

function orderedEdgeCandidates(coordinator?: Coordinator | null) {
  const current = readTransportConnection();
  const candidates: EdgeCandidate[] = [{ origin: DEFAULT_EDGE_ORIGIN }];

  if (current && current.mode !== 'remote' && current.origin && current.origin !== DEFAULT_EDGE_ORIGIN) {
    candidates.push({ origin: current.origin, secureChannel: current.secureChannel });
  }

  if (coordinator) {
    const trust = coordinatorTrust(coordinator);
    for (const origin of coordinator.coordinatorUrls || []) {
      const normalizedOrigin = safeNormalizeEdgeOrigin(origin);
      if (normalizedOrigin && normalizedOrigin !== DEFAULT_EDGE_ORIGIN) {
        candidates.push({ origin: normalizedOrigin, trust });
      }
    }
    candidates.push({ origin: DEFAULT_EDGE_ORIGIN, trust });
  }

  const unique = new Set<string>();
  return candidates.filter((candidate) => {
    const origin = safeNormalizeEdgeOrigin(candidate.origin);
    if (!origin) return false;
    if (
      !candidate.trust &&
      !candidate.secureChannel &&
      !readLegacyEdgeMigrationCredential() &&
      !isLoopbackEdgeOrigin(origin)
    )
      return false;
    const key = `${origin}|${candidate.trust?.agentDeviceId || ''}|${candidate.secureChannel ? 'secure' : ''}`;
    if (unique.has(key)) return false;
    unique.add(key);
    candidate.origin = origin;
    return true;
  });
}

async function selectCoordinator(restaurantId: string, coordinator?: Coordinator | null) {
  if (coordinator?.restaurantId && coordinator.restaurantId !== restaurantId) return null;
  let compatibilityError: LocalAgentCompatibilityError | null = null;
  for (const candidate of orderedEdgeCandidates(coordinator)) {
    const result = await probe(candidate.origin, restaurantId, candidate.trust);
    if (result.status === 'selected') return result.connection;
    if (result.status === 'incompatible') {
      compatibilityError = new LocalAgentCompatibilityError(result.protocolVersion);
    }
  }
  if (compatibilityError) throw compatibilityError;
  return null;
}

async function discoverCoordinator(restaurantId: string) {
  const identity = await readStoredDeviceIdentity();
  if (identity?.device?.status === 'ACTIVE' && identity.restaurantContext?.restaurantId === restaurantId) {
    const discover = () =>
      apiPostDeviceRemote<{ restaurantId: string; coordinator?: Coordinator | null }>(
        '/pos/auth/device-transport/',
        {},
        { timeout: 8_000 },
      );
    let response;
    try {
      response = await discover();
    } catch (error) {
      if (!axios.isAxiosError(error) || error.response?.data?.code !== 'device_lease_expired') throw error;
      const lease = await apiPostDeviceRemote<{ leaseExpiresAt: string }>(
        '/devices/lease/renew/',
        {},
        { timeout: 8_000 },
      );
      await updateStoredDeviceIdentity((current) => {
        if (
          current.device?.id !== identity.device?.id ||
          current.publicKeyFingerprint !== identity.publicKeyFingerprint
        )
          throw new Error('POS device changed during discovery.');
        return {
          ...current,
          device: current.device ? { ...current.device, leaseExpiresAt: lease.leaseExpiresAt } : undefined,
        };
      });
      response = await discover();
    }
    return response.restaurantId === restaurantId ? (response.coordinator ?? null) : null;
  }
  const session = readStoredSession();
  if (!session?.token) return null;
  const response = await apiPostRemote<{ restaurantId: string; coordinator?: Coordinator | null }>(
    '/pos/auth/transport/',
    terminalIdentity(),
    { timeout: 8_000 },
  );
  return response.restaurantId === restaurantId ? (response.coordinator ?? null) : null;
}

let refreshFlight: ReturnType<typeof refreshTransportModeOnce> | null = null;
const discoveryRetryAfter = new Map<string, number>();

export function refreshTransportMode() {
  if (!refreshFlight) {
    refreshFlight = refreshTransportModeOnce().finally(() => {
      refreshFlight = null;
    });
  }
  return refreshFlight;
}

export async function recoverLocalAgentConnection(failedOrigin: string, restaurantId: string) {
  const current = readTransportConnection();
  if (!current || current.mode === 'remote' || current.restaurantId !== restaurantId) return false;
  if (current.origin !== failedOrigin) return Boolean(current.backendOnline);
  if (current.mode !== 'router') return false;
  try {
    await refreshTransportMode();
  } catch {
    return false;
  }
  const next = readTransportConnection();
  return Boolean(
    next &&
      next.mode !== 'remote' &&
      next.restaurantId === current.restaurantId &&
      next.backendOnline &&
      next.origin !== failedOrigin,
  );
}

async function refreshTransportModeOnce() {
  const storedConnection = readTransportConnection();
  const sessionRestaurantId = readStoredSession()?.restaurantContext?.restaurantId;
  const pairedRestaurantId =
    !storedConnection && !sessionRestaurantId
      ? (await readStoredDeviceIdentity().catch(() => null))?.restaurantContext?.restaurantId
      : undefined;
  const fallbackRestaurantId = sessionRestaurantId ?? pairedRestaurantId;
  const current: PosTransportConnection | null =
    storedConnection ??
    (fallbackRestaurantId
      ? {
          mode: 'remote',
          restaurantId: fallbackRestaurantId,
          backendOnline: true,
          selectedAt: new Date().toISOString(),
        }
      : null);
  if (!current) return { changed: false, requiresRelogin: false, mode: 'remote' as PosTransportMode };
  let next: PosTransportConnection | null = null;
  if (current.mode === 'remote') {
    try {
      next = await selectCoordinator(current.restaurantId, await discoverCoordinator(current.restaurantId));
    } catch (error) {
      if (error instanceof LocalAgentCompatibilityError) throw error;
      next = null;
    }
  } else if (
    current.origin &&
    (current.secureChannel || readLegacyEdgeMigrationCredential() || isLoopbackEdgeOrigin(current.origin))
  ) {
    // Once an edge transport is selected, POS browser traffic stays entirely
    // on the Agent. A previously pinned Agent can prove the same identity on
    // loopback without a backend discovery request.
    if (current.mode === 'router') {
      const localResult = await probe(DEFAULT_EDGE_ORIGIN, current.restaurantId);
      if (localResult.status === 'selected') next = localResult.connection;
    }
    if (!next) {
      const result = await probe(current.origin, current.restaurantId);
      if (result.status === 'incompatible') throw new LocalAgentCompatibilityError(result.protocolVersion);
      next = result.status === 'selected' ? result.connection : null;
    }
    if (!next && current.mode === 'router') {
      const key = `${current.restaurantId}|${current.origin}`;
      if (Date.now() >= (discoveryRetryAfter.get(key) || 0)) {
        discoveryRetryAfter.set(key, Date.now() + 15_000);
        try {
          const coordinator = await discoverCoordinator(current.restaurantId);
          const trust = coordinatorTrust(coordinator);
          if (coordinator?.restaurantId === current.restaurantId && trust) {
            // Re-probing old/loopback addresses only adds latency. Every new
            // address must prove the backend-attested Agent identity first.
            for (const value of [...new Set(coordinator.coordinatorUrls || [])].slice(0, 8)) {
              const origin = safeNormalizeEdgeOrigin(value);
              if (!origin || origin === current.origin || isLoopbackEdgeOrigin(origin)) continue;
              const candidate = await probe(origin, current.restaurantId, trust);
              if (candidate.status === 'selected') {
                next = candidate.connection;
                break;
              }
              if (candidate.status === 'incompatible')
                throw new LocalAgentCompatibilityError(candidate.protocolVersion);
            }
          }
        } catch (error) {
          if (error instanceof LocalAgentCompatibilityError) throw error;
        }
        if (next) discoveryRetryAfter.delete(key);
      }
    }
  }
  if (!next) {
    next =
      current.mode === 'remote'
        ? {
            mode: 'remote',
            restaurantId: current.restaurantId,
            backendOnline: true,
            selectedAt: new Date().toISOString(),
          }
        : {
            ...current,
            // Edge selection is sticky. A stopped/restarting Agent must not
            // silently convert the browser into a direct backend POS client.
            backendOnline: false,
            selectedAt: new Date().toISOString(),
          };
  }
  const currentGroup = current.mode === 'remote' ? 'remote' : 'edge';
  const nextGroup = next.mode === 'remote' ? 'remote' : 'edge';
  // A logout/re-pair in another flow must not be overwritten by a late probe.
  const latest = readTransportConnection();
  if (
    latest?.restaurantId !== storedConnection?.restaurantId ||
    latest?.mode !== storedConnection?.mode ||
    latest?.origin !== storedConnection?.origin
  ) {
    return { changed: false, requiresRelogin: false, mode: readTransportConnection()?.mode ?? 'remote' };
  }
  persistTransportConnection(next);
  return {
    changed: current.mode !== next.mode || current.origin !== next.origin,
    requiresRelogin: currentGroup !== nextGroup,
    mode: next.mode,
  };
}

export async function refreshTransportAndSync() {
  const selection = await refreshTransportMode();
  if (selection.mode !== 'remote') {
    await apiPost('/sync/refresh', {}, { timeout: 60_000 });
  }
  return selection;
}

export async function refreshTransportAndReload() {
  const selection = await refreshTransportAndSync();
  if (selection.requiresRelogin) {
    persistSession(null);
    window.location.assign('/pin-login');
    return;
  }
  window.location.reload();
}
