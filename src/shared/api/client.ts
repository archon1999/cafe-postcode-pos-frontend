import axios from 'axios';

import { persistSession, readStoredLocale, readStoredSession } from 'modules/auth/data-access';

import { resolveApiBaseUrl } from './apiUrl';

export const apiClient = axios.create({
  baseURL: resolveApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const session = readStoredSession();
  const locale = readStoredLocale();

  if (session?.token) {
    config.headers.Authorization = `Token ${session.token}`;
  }

  config.headers['Accept-Language'] = locale;
  config.headers['X-Language'] = locale;
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      if (status === 401 || status === 403) {
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

export async function apiPost<T>(url: string, payload?: unknown) {
  const response = await apiClient.post<T>(url, payload);
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
