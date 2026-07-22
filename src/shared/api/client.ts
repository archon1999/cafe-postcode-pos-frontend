import axios, { type AxiosRequestConfig } from 'axios';

import { persistSession, readStoredLocale, readStoredSession } from 'modules/auth/data-access';

import { resolveApiBaseUrl, resolveRemoteApiBaseUrl } from './apiUrl';
import { readEdgeToken } from './edgeConnection';

export const apiClient = axios.create({
  baseURL: resolveApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

export const publicApiClient = axios.create({
  baseURL: resolveApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

export const remotePublicApiClient = axios.create({
  baseURL: resolveRemoteApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

export const remoteApiClient = axios.create({
  baseURL: resolveRemoteApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const session = readStoredSession();
  const locale = readStoredLocale();
  const edgeToken = readEdgeToken();

  config.baseURL = resolveApiBaseUrl();

  if (session?.token) {
    config.headers.Authorization = `Token ${session.token}`;
  }

  config.headers['Accept-Language'] = locale;
  config.headers['X-Language'] = locale;
  if (edgeToken) config.headers['X-Edge-Token'] = edgeToken;
  if (config.method && config.method.toLowerCase() !== 'get' && !config.headers['X-Edge-Operation-ID']) {
    config.headers['X-Edge-Operation-ID'] = createEdgeOperationId();
  }
  return config;
});

publicApiClient.interceptors.request.use((config) => {
  const locale = readStoredLocale();
  const edgeToken = readEdgeToken();

  config.baseURL = resolveApiBaseUrl();

  config.headers['Accept-Language'] = locale;
  config.headers['X-Language'] = locale;
  if (edgeToken) config.headers['X-Edge-Token'] = edgeToken;
  return config;
});

remotePublicApiClient.interceptors.request.use((config) => {
  const locale = readStoredLocale();

  config.baseURL = resolveRemoteApiBaseUrl();
  config.headers['Accept-Language'] = locale;
  config.headers['X-Language'] = locale;
  return config;
});

remoteApiClient.interceptors.request.use((config) => {
  const session = readStoredSession();
  const locale = readStoredLocale();

  config.baseURL = resolveRemoteApiBaseUrl();
  if (session?.token) config.headers.Authorization = `Token ${session.token}`;
  config.headers['Accept-Language'] = locale;
  config.headers['X-Language'] = locale;
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      if (status === 401) {
        persistSession(null);
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/restaurant-login')) {
          window.location.replace('/pin-login');
        }
      }
    }

    throw error;
  },
);

export async function apiGet<T>(url: string) {
  const response = await apiClient.get<T>(url);
  return response.data;
}

export async function apiGetPublic<T>(url: string, config?: AxiosRequestConfig) {
  const response = await publicApiClient.get<T>(url, config);
  return response.data;
}

export async function apiGetRemotePublic<T>(url: string, config?: AxiosRequestConfig) {
  const response = await remotePublicApiClient.get<T>(url, config);
  return response.data;
}

export async function apiPostRemotePublic<T>(url: string, payload?: unknown, config?: AxiosRequestConfig) {
  const response = await remotePublicApiClient.post<T>(url, payload, config);
  return response.data;
}

export async function apiPostRemote<T>(url: string, payload?: unknown, config?: AxiosRequestConfig) {
  const response = await remoteApiClient.post<T>(url, payload, config);
  return response.data;
}

export async function apiPost<T>(url: string, payload?: unknown, config?: AxiosRequestConfig) {
  const response = await apiClient.post<T>(url, payload, config);
  return response.data;
}

export async function apiPatch<T>(url: string, payload?: unknown) {
  const response = await apiClient.patch<T>(url, payload);
  return response.data;
}

export async function apiDelete<T = void>(url: string) {
  const response = await apiClient.delete<T>(url);
  return response.data;
}

type CollectionResponse<T> =
  | T[]
  | {
      data?: T[];
    };

export function unwrapCollection<T>(payload: CollectionResponse<T>) {
  if (Array.isArray(payload)) {
    return payload;
  }

  return payload.data ?? [];
}

function createEdgeOperationId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `pos:${crypto.randomUUID()}`;
  }
  return `pos:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}
