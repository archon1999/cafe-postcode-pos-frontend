export const EDGE_ORIGIN_STORAGE_KEY = 'cafe-pos.edge-origin';
export const EDGE_TOKEN_STORAGE_KEY = 'cafe-pos.edge-token';
export const DEFAULT_EDGE_ORIGIN = 'http://127.0.0.1:18181';

function configuredValue(value?: string) {
  return value?.trim().replace(/^['"]|['"]$/g, '') ?? '';
}

export function normalizeEdgeOrigin(value: string) {
  const normalized = value.trim().replace(/\/+$/, '').replace(/\/v1$/, '');
  const parsed = new URL(normalized);
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.pathname !== '/') {
    throw new Error('Coordinator manzili http://IP:18181 ko‘rinishida bo‘lishi kerak.');
  }
  return parsed.origin;
}

export function readEdgeOrigin() {
  const stored = readStoredEdgeOrigin();
  if (stored) return stored;
  return (configuredValue(import.meta.env.VITE_EDGE_BASE_URL) || DEFAULT_EDGE_ORIGIN).replace(/\/+$/, '');
}

export function readStoredEdgeOrigin() {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(EDGE_ORIGIN_STORAGE_KEY)?.trim().replace(/\/+$/, '') ?? '';
}

export function readEdgeToken() {
  const configured = configuredValue(import.meta.env.VITE_EDGE_TOKEN);
  if (configured) return configured;
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(EDGE_TOKEN_STORAGE_KEY)?.trim() ?? '';
}

export function persistEdgeConnection(origin: string, token: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(EDGE_ORIGIN_STORAGE_KEY, normalizeEdgeOrigin(origin));
  window.localStorage.setItem(EDGE_TOKEN_STORAGE_KEY, token.trim());
}

export function clearEdgeConnection() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(EDGE_ORIGIN_STORAGE_KEY);
  window.localStorage.removeItem(EDGE_TOKEN_STORAGE_KEY);
}
