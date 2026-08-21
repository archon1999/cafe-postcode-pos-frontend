import { readStoredDeviceIdentity } from 'modules/auth/data-access/device/device-identity.store';
import { persistSession, readStoredSession } from 'modules/auth/data-access/storage/session.storage';
import type { PosRestaurantContext } from 'modules/auth/domain';

import { apiPostRemote } from './client';
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

export async function refreshTransportMode() {
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
    const session = readStoredSession();
    if (session?.token) {
      try {
        const response = await apiPostRemote<{ restaurantId: string; coordinator?: Coordinator | null }>(
          '/pos/auth/transport/',
          terminalIdentity(),
          { timeout: 8_000 },
        );
        if (response.restaurantId === current.restaurantId) {
          next = await selectCoordinator(current.restaurantId, response.coordinator);
        }
      } catch (error) {
        if (error instanceof LocalAgentCompatibilityError) throw error;
        next = null;
      }
    }
  } else if (
    current.origin &&
    (current.secureChannel || readLegacyEdgeMigrationCredential() || isLoopbackEdgeOrigin(current.origin))
  ) {
    const result = await probe(current.origin, current.restaurantId);
    if (result.status === 'incompatible') throw new LocalAgentCompatibilityError(result.protocolVersion);
    next = result.status === 'selected' ? result.connection : null;
  }
  if (!next)
    next = {
      mode: 'remote',
      restaurantId: current.restaurantId,
      backendOnline: true,
      selectedAt: new Date().toISOString(),
    };
  const currentGroup = current.mode === 'remote' ? 'remote' : 'edge';
  const nextGroup = next.mode === 'remote' ? 'remote' : 'edge';
  persistTransportConnection(next);
  return { changed: current.mode !== next.mode, requiresRelogin: currentGroup !== nextGroup, mode: next.mode };
}

export async function refreshTransportAndReload() {
  const selection = await refreshTransportMode();
  if (selection.requiresRelogin) {
    persistSession(null);
    window.location.assign('/pin-login');
    return;
  }
  window.location.reload();
}
