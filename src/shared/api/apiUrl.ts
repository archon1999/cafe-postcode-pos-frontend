const LOCAL_API_ORIGIN = 'http://127.0.0.1:8000';
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

  if (typeof window === 'undefined') {
    return joinUrl(LOCAL_API_ORIGIN, APP_API_PATH);
  }

  const { hostname, port, protocol } = window.location;
  if (port && port !== '8000') {
    return `${protocol}//${hostname}:8000/${APP_API_PATH}`;
  }

  return `/${APP_API_PATH}`;
}
