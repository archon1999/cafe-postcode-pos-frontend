import axios from 'axios';

import { persistSession, readStoredSession } from 'modules/auth/data-access/storage/session.storage';
import type { PosRestaurantContext } from 'modules/auth/domain';

import { resolveRemoteApiBaseUrl } from './apiUrl';
import {
  DEFAULT_EDGE_ORIGIN,
  isLoopbackEdgeOrigin,
  normalizeEdgeOrigin,
  persistTransportConnection,
  readTransportConnection,
  type PosTransportConnection,
  type PosTransportMode,
} from './edgeConnection';

const TERMINAL_ID_KEY = 'cafe-pos.terminal-id';

type Coordinator = NonNullable<PosRestaurantContext['coordinator']>;
type HealthResponse = { restaurantId?: string; backendOnline?: boolean };
type StatusResponse = { status?: { backend?: { online?: boolean } } };
type EdgeCandidate = { origin: string; token?: string };

function safeNormalizeEdgeOrigin(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    return normalizeEdgeOrigin(value);
  } catch {
    return null;
  }
}

function terminalIdentity() {
  let id = localStorage.getItem(TERMINAL_ID_KEY)?.trim() || '';
  if (!id) {
    id = `pos-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
    localStorage.setItem(TERMINAL_ID_KEY, id);
  }
  return { terminalId: id, terminalName: navigator.userAgent.includes('Windows') ? 'Windows POS' : 'POS terminal' };
}

async function edgeFetch<T>(
  origin: string,
  token: string | undefined,
  path: string,
  init?: RequestInit,
  timeoutMs = 2_500,
): Promise<T> {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${normalizeEdgeOrigin(origin)}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(token ? { 'X-Edge-Token': token } : {}),
        ...init?.headers,
      },
    });
    if (!response.ok) throw new Error(`Edge HTTP ${response.status}`);
    return (await response.json()) as T;
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

async function probe(origin: string, token: string | undefined, restaurantId: string): Promise<PosTransportConnection | null> {
  try {
    const health = await edgeFetch<HealthResponse>(origin, token, '/health');
    if (health.restaurantId !== restaurantId) return null;
    let backendOnline = health.backendOnline;
    if (typeof backendOnline !== 'boolean') {
      // Compatibility with agents released before the lightweight health signal.
      const system = await edgeFetch<StatusResponse>(origin, token, '/v1/system/status', undefined, 7_000);
      backendOnline = system.status?.backend?.online !== false;
    }
    return {
      mode: backendOnline ? 'router' : 'local',
      restaurantId,
      origin: normalizeEdgeOrigin(origin),
      ...(token ? { token } : {}),
      backendOnline,
      selectedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function orderedEdgeCandidates(coordinator?: Coordinator | null) {
  const current = readTransportConnection();
  const candidates: EdgeCandidate[] = [{ origin: DEFAULT_EDGE_ORIGIN }];

  if (current && current.mode !== 'remote' && current.origin && current.origin !== DEFAULT_EDGE_ORIGIN) {
    candidates.push({ origin: current.origin, token: current.token });
  }

  if (coordinator?.edgeToken) {
    for (const origin of coordinator.coordinatorUrls || []) {
      const normalizedOrigin = safeNormalizeEdgeOrigin(origin);
      if (normalizedOrigin && normalizedOrigin !== DEFAULT_EDGE_ORIGIN) {
        candidates.push({ origin: normalizedOrigin, token: coordinator.edgeToken });
      }
    }
    candidates.push({ origin: DEFAULT_EDGE_ORIGIN, token: coordinator.edgeToken });
  }

  if (current && current.mode !== 'remote' && current.origin && current.token) {
    candidates.push({ origin: current.origin, token: current.token });
  }

  const unique = new Set<string>();
  return candidates.filter((candidate) => {
    const origin = safeNormalizeEdgeOrigin(candidate.origin);
    if (!origin) return false;
    if (!candidate.token && !isLoopbackEdgeOrigin(origin)) return false;
    const key = `${origin}|${candidate.token || ''}`;
    if (unique.has(key)) return false;
    unique.add(key);
    candidate.origin = origin;
    return true;
  });
}

async function selectCoordinator(restaurantId: string, coordinator?: Coordinator | null) {
  if (coordinator?.restaurantId && coordinator.restaurantId !== restaurantId) return null;
  for (const candidate of orderedEdgeCandidates(coordinator)) {
    const connection = await probe(candidate.origin, candidate.token, restaurantId);
    if (connection) return connection;
  }
  return null;
}

async function resolveRestaurantFromLocalAgent(code: string, identity: ReturnType<typeof terminalIdentity>) {
  for (const candidate of orderedEdgeCandidates()) {
    try {
      const context = await edgeFetch<PosRestaurantContext>(
        candidate.origin,
        candidate.token,
        '/v1/pos/auth/restaurant-code/',
        { method: 'POST', body: JSON.stringify({ code, ...identity }) },
      );
      const selected = await probe(candidate.origin, candidate.token, context.restaurantId);
      persistTransportConnection(
        selected || {
          mode: 'local',
          restaurantId: context.restaurantId,
          origin: candidate.origin,
          ...(candidate.token ? { token: candidate.token } : {}),
          backendOnline: false,
        },
      );
      return context;
    } catch {
      // Try the next local candidate, then the remote backend.
    }
  }
  return null;
}

export async function resolveRestaurantTransport(code: string): Promise<PosRestaurantContext> {
  const identity = terminalIdentity();
  const localContext = await resolveRestaurantFromLocalAgent(code, identity);
  if (localContext) return localContext;

  const response = await axios.post<PosRestaurantContext>(
    `${resolveRemoteApiBaseUrl()}/pos/auth/restaurant-code/`,
    { code, ...identity },
    { timeout: 8_000 },
  );
  const context = response.data;
  const edge = await selectCoordinator(context.restaurantId, context.coordinator);
  persistTransportConnection(edge || { mode: 'remote', restaurantId: context.restaurantId, backendOnline: true });
  return context;
}

export async function refreshTransportMode() {
  const current = readTransportConnection();
  if (!current) return { changed: false, requiresRelogin: false, mode: 'remote' as PosTransportMode };
  let next: PosTransportConnection | null = null;
  if (current.mode === 'remote') {
    const session = readStoredSession();
    if (session?.token) {
      try {
        const response = await axios.post<{ restaurantId: string; coordinator?: Coordinator | null }>(
          `${resolveRemoteApiBaseUrl()}/pos/auth/transport/`,
          terminalIdentity(),
          { timeout: 8_000, headers: { Authorization: `Token ${session.token}` } },
        );
        if (response.data.restaurantId === current.restaurantId) {
          next = await selectCoordinator(current.restaurantId, response.data.coordinator);
        }
      } catch {
        next = null;
      }
    }
  } else if (current.origin && current.token) {
    next = await probe(current.origin, current.token, current.restaurantId);
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
