export const EDGE_ORIGIN_STORAGE_KEY = 'cafe-pos.edge-origin';
export const EDGE_TOKEN_STORAGE_KEY = 'cafe-pos.edge-token';
export const TRANSPORT_STORAGE_KEY = 'cafe-pos.transport';
export const DEFAULT_EDGE_ORIGIN = 'http://127.0.0.1:18181';

export type PosTransportMode = 'remote' | 'router' | 'local';

export type PosTransportConnection = {
  mode: PosTransportMode;
  restaurantId: string;
  origin?: string;
  token?: string;
  protocolVersion?: number;
  backendOnline?: boolean;
  selectedAt: string;
};

function configuredValue(value?: string) {
  return value?.trim().replace(/^['"]|['"]$/g, '') ?? '';
}

export function normalizeEdgeOrigin(value: string) {
  const parsed = new URL(value.trim());
  const pathname = parsed.pathname.replace(/\/+$/, '') || '/';
  const legacyApiPaths = new Set(['/v1', '/api', '/api/v1', '/v1/api']);

  if (legacyApiPaths.has(pathname)) parsed.pathname = '/';
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.pathname !== '/') {
    throw new Error('Coordinator manzili http://IP:18181 ko‘rinishida bo‘lishi kerak.');
  }
  return parsed.origin;
}

export function isLoopbackEdgeOrigin(value?: string) {
  if (!value) return false;
  try {
    const parsed = new URL(normalizeEdgeOrigin(value));
    return parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost' || parsed.hostname === '[::1]';
  } catch {
    return false;
  }
}

export function readTransportConnection(): PosTransportConnection | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(TRANSPORT_STORAGE_KEY);
  if (!raw) return null;
  try {
    const connection = JSON.parse(raw) as PosTransportConnection;
    if (!connection || typeof connection !== 'object') throw new Error();
    if (!['remote', 'router', 'local'].includes(connection.mode) || !connection.restaurantId) throw new Error();
    if (connection.mode !== 'remote') {
      connection.origin = normalizeEdgeOrigin(connection.origin || '');
      if (!connection.token && !isLoopbackEdgeOrigin(connection.origin)) throw new Error();
    }
    return connection;
  } catch {
    window.localStorage.removeItem(TRANSPORT_STORAGE_KEY);
    return null;
  }
}

export function persistTransportConnection(
  connection: Omit<PosTransportConnection, 'selectedAt'> & { selectedAt?: string },
) {
  if (typeof window === 'undefined') return;
  const normalized: PosTransportConnection = {
    ...connection,
    ...(connection.origin ? { origin: normalizeEdgeOrigin(connection.origin) } : {}),
    selectedAt: connection.selectedAt || new Date().toISOString(),
  };
  window.localStorage.setItem(TRANSPORT_STORAGE_KEY, JSON.stringify(normalized));
  if (normalized.mode === 'remote') {
    window.localStorage.removeItem(EDGE_ORIGIN_STORAGE_KEY);
    window.localStorage.removeItem(EDGE_TOKEN_STORAGE_KEY);
  } else {
    window.localStorage.setItem(EDGE_ORIGIN_STORAGE_KEY, normalized.origin || '');
    window.localStorage.setItem(EDGE_TOKEN_STORAGE_KEY, normalized.token || '');
  }
}

export function readEdgeOrigin() {
  const active = readTransportConnection();
  if (active?.mode !== 'remote' && active?.origin) return active.origin;
  const stored = readStoredEdgeOrigin();
  if (stored) return stored;
  return (configuredValue(import.meta.env.VITE_EDGE_BASE_URL) || DEFAULT_EDGE_ORIGIN).replace(/\/+$/, '');
}

export function readStoredEdgeOrigin() {
  if (typeof window === 'undefined') return '';
  const active = readTransportConnection();
  if (active?.mode === 'remote') return '';
  if (active?.origin) return active.origin;
  const stored = window.localStorage.getItem(EDGE_ORIGIN_STORAGE_KEY)?.trim() ?? '';
  if (!stored) return '';
  try {
    const normalized = normalizeEdgeOrigin(stored);
    if (normalized !== stored) window.localStorage.setItem(EDGE_ORIGIN_STORAGE_KEY, normalized);
    return normalized;
  } catch {
    window.localStorage.removeItem(EDGE_ORIGIN_STORAGE_KEY);
    return '';
  }
}

export function readEdgeToken() {
  const active = readTransportConnection();
  if (active?.mode === 'remote') return '';
  if (active?.token) return active.token;
  const configured = configuredValue(import.meta.env.VITE_EDGE_TOKEN);
  if (configured) return configured;
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(EDGE_TOKEN_STORAGE_KEY)?.trim() ?? '';
}

export function persistEdgeConnection(origin: string, token: string, restaurantId = '') {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(EDGE_ORIGIN_STORAGE_KEY, normalizeEdgeOrigin(origin));
  window.localStorage.setItem(EDGE_TOKEN_STORAGE_KEY, token.trim());
  if (restaurantId) {
    persistTransportConnection({ mode: 'router', restaurantId, origin, token, backendOnline: true });
  }
}

export function clearEdgeConnection() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(EDGE_ORIGIN_STORAGE_KEY);
  window.localStorage.removeItem(EDGE_TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(TRANSPORT_STORAGE_KEY);
}

export function ignoreMismatchedAgent(restaurantId: string) {
  const current = readTransportConnection();
  if (!current || current.restaurantId !== restaurantId) {
    persistTransportConnection({ mode: 'remote', restaurantId, backendOnline: true });
  }
}
