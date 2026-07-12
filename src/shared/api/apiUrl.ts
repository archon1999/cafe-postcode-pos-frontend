import { readEdgeOrigin, readStoredEdgeOrigin } from './edgeConnection';

const APP_API_PATH = 'api/v1';
const VERSIONED_API_PATTERN = /\/api\/v\d+(?:\/|$)/;

function normalizeConfigValue(value: string | undefined) {
  return value?.trim().replace(/^['"]|['"]$/g, '') ?? '';
}

function stripTrailingSlashes(value: string) {
  return value.replace(/\/+$/, '');
}

function joinUrl(baseUrl: string, path: string) {
  return `${stripTrailingSlashes(baseUrl)}/${path.replace(/^\/+/, '')}`;
}

export function resolveApiBaseUrl() {
  const edgeOrigin = readStoredEdgeOrigin();
  if (edgeOrigin) {
    return joinUrl(edgeOrigin, 'v1');
  }
  const configuredBaseUrl = stripTrailingSlashes(normalizeConfigValue(import.meta.env.VITE_API_BASE_URL));

  if (configuredBaseUrl) {
    if (VERSIONED_API_PATTERN.test(configuredBaseUrl)) {
      return configuredBaseUrl;
    }

    if (configuredBaseUrl.endsWith('/api')) {
      return joinUrl(configuredBaseUrl, 'v1');
    }

    return joinUrl(configuredBaseUrl, APP_API_PATH);
  }

  return joinUrl(readEdgeOrigin(), 'v1');
}
