import axios from 'axios';

import { persistSession, readStoredSession } from 'modules/auth/data-access/storage/session.storage';
import type { PosRestaurantContext } from 'modules/auth/domain';

import { resolveRemoteApiBaseUrl } from './apiUrl';
import {
  DEFAULT_EDGE_ORIGIN,
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
  token: string,
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
        'X-Edge-Token': token,
        ...init?.headers,
      },
    });
    if (!response.ok) throw new Error(`Edge HTTP ${response.status}`);
    return (await response.json()) as T;
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

async function probe(origin: string, token: string, restaurantId: string): Promise<PosTransportConnection | null> {
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
      token,
      backendOnline,
      selectedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

async function selectCoordinator(restaurantId: string, coordinator?: Coordinator | null) {
  const current = readTransportConnection();
  const candidates: Array<{ origin: string; token: string }> = [];
  if (coordinator?.restaurantId === restaurantId && coordinator.edgeToken) {
    for (const origin of [...(coordinator.coordinatorUrls || []), DEFAULT_EDGE_ORIGIN]) {
      const normalizedOrigin = safeNormalizeEdgeOrigin(origin);
      if (normalizedOrigin) candidates.push({ origin: normalizedOrigin, token: coordinator.edgeToken });
    }
  }
  if (current?.restaurantId === restaurantId && current.origin && current.token) {
    candidates.unshift({ origin: current.origin, token: current.token });
  }
  const unique = new Set<string>();
  for (const candidate of candidates) {
    const key = `${candidate.origin}|${candidate.token}`;
    if (unique.has(key)) continue;
    unique.add(key);
    const connection = await probe(candidate.origin, candidate.token, restaurantId);
    if (connection) return connection;
  }
  return null;
}

export async function resolveRestaurantTransport(code: string): Promise<PosRestaurantContext> {
  const identity = terminalIdentity();
  let remoteError: unknown;
  try {
    const response = await axios.post<PosRestaurantContext>(
      `${resolveRemoteApiBaseUrl()}/pos/auth/restaurant-code/`,
      { code, ...identity },
      { timeout: 8_000 },
    );
    const context = response.data;
    const edge = await selectCoordinator(context.restaurantId, context.coordinator);
    persistTransportConnection(edge || { mode: 'remote', restaurantId: context.restaurantId, backendOnline: true });
    return context;
  } catch (error) {
    remoteError = error;
  }

  const cached = readTransportConnection();
  if (cached && cached.mode !== 'remote' && cached.origin && cached.token) {
    try {
      const context = await edgeFetch<PosRestaurantContext>(
        cached.origin,
        cached.token,
        '/v1/pos/auth/restaurant-code/',
        { method: 'POST', body: JSON.stringify({ code }) },
      );
      if (context.restaurantId === cached.restaurantId) {
        const selected = await probe(cached.origin, cached.token, context.restaurantId);
        if (selected) persistTransportConnection(selected);
        return context;
      }
    } catch {
      // The cached agent belongs to another restaurant or has no usable offline context.
    }
  }
  throw remoteError;
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
