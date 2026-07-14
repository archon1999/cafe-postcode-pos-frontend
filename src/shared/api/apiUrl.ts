import { readTransportConnection } from './edgeConnection';

const APP_API_PATH = 'api/v1';
const VERSIONED_API_PATTERN = /\/(?:api\/)?v\d+(?:\/|$)/;

export function isVersionedApiBaseUrl(value: string) {
  return VERSIONED_API_PATTERN.test(value);
}

function normalizeConfigValue(value: string | undefined) {
  return value?.trim().replace(/^['"]|['"]$/g, '') ?? '';
}

function stripTrailingSlashes(value: string) {
  return value.replace(/\/+$/, '');
}

function joinUrl(baseUrl: string, path: string) {
  return `${stripTrailingSlashes(baseUrl)}/${path.replace(/^\/+/, '')}`;
}

export function resolveRemoteApiBaseUrl() {
  const configuredBaseUrl = stripTrailingSlashes(
    normalizeConfigValue(import.meta.env.VITE_REMOTE_API_BASE_URL || import.meta.env.VITE_API_BASE_URL),
  );

  if (configuredBaseUrl) {
    if (isVersionedApiBaseUrl(configuredBaseUrl)) {
      return configuredBaseUrl;
    }

    if (configuredBaseUrl.endsWith('/api')) {
      return joinUrl(configuredBaseUrl, 'v1');
    }

    return joinUrl(configuredBaseUrl, APP_API_PATH);
  }

  if (typeof window !== 'undefined') return joinUrl(window.location.origin, APP_API_PATH);
  return joinUrl('http://127.0.0.1:8000', APP_API_PATH);
}

export function resolveApiBaseUrl() {
  const connection = readTransportConnection();
  if (connection?.mode !== 'remote' && connection?.origin) return joinUrl(connection.origin, 'v1');
  return resolveRemoteApiBaseUrl();
}
