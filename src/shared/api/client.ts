import axios, { AxiosHeaders, type AxiosRequestConfig, type RawAxiosHeaders } from 'axios';

import {
  createDeviceProofHeaders,
  dispatchPosDeviceSecurityEvent,
  isPosDeviceSecurityCode,
  readStoredDeviceIdentity,
} from 'modules/auth/data-access/device';
import { dispatchPosSessionLocked } from 'modules/auth/data-access/storage/session-security';
import { persistSession, readStoredLocale, readStoredSession } from 'modules/auth/data-access/storage/session.storage';

import { resolveApiBaseUrl, resolveRemoteApiBaseUrl } from './apiUrl';
import { readOrCreateEdgeTerminalIdentity } from './edgeConnection';
import {
  ensureLocalAgentSecureChannel,
  protectLocalAxiosRequest,
  resetLocalAxiosRequestForRetry,
  unprotectLocalAxiosResponse,
} from './edgeSecureChannel';
import { executeFinancialCommand, isFinancialMutation, recoverFinancialCommand } from './financialCommands';

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

async function applyDeviceProof(config: AxiosRequestConfig) {
  const remote = config.baseURL === resolveRemoteApiBaseUrl();
  const identity = await readStoredDeviceIdentity();
  const localDeviceId = remote || identity?.device ? undefined : readOrCreateEdgeTerminalIdentity().terminalId;
  const proof = await createDeviceProofHeaders(config, identity ?? undefined, localDeviceId);
  if (!proof) return config;
  config.data = proof.wireData;
  const headers = AxiosHeaders.from(config.headers as RawAxiosHeaders | AxiosHeaders | undefined);
  for (const [header, value] of Object.entries(proof.headers)) headers.set(header, value);
  config.headers = headers;
  return config;
}

apiClient.interceptors.request.use(async (config) => {
  const session = readStoredSession();
  const locale = readStoredLocale();

  config.baseURL = resolveApiBaseUrl();

  if (session?.token) {
    config.headers.Authorization = `Token ${session.token}`;
  }

  config.headers['Accept-Language'] = locale;
  config.headers['X-Language'] = locale;
  if (config.method && config.method.toLowerCase() !== 'get' && !config.headers['X-Edge-Operation-ID']) {
    config.headers['X-Edge-Operation-ID'] = createEdgeOperationId();
  }
  if (config.baseURL !== resolveRemoteApiBaseUrl()) await protectLocalAxiosRequest(config);
  await applyDeviceProof(config);
  return config;
});

publicApiClient.interceptors.request.use(async (config) => {
  const locale = readStoredLocale();

  config.baseURL = resolveApiBaseUrl();

  config.headers['Accept-Language'] = locale;
  config.headers['X-Language'] = locale;
  if (config.baseURL !== resolveRemoteApiBaseUrl()) await protectLocalAxiosRequest(config);
  await applyDeviceProof(config);
  return config;
});

remotePublicApiClient.interceptors.request.use((config) => {
  const locale = readStoredLocale();

  config.baseURL = resolveRemoteApiBaseUrl();
  config.headers['Accept-Language'] = locale;
  config.headers['X-Language'] = locale;
  return config;
});

remoteApiClient.interceptors.request.use(async (config) => {
  const session = readStoredSession();
  const locale = readStoredLocale();

  config.baseURL = resolveRemoteApiBaseUrl();
  if (session?.token) config.headers.Authorization = `Token ${session.token}`;
  config.headers['Accept-Language'] = locale;
  config.headers['X-Language'] = locale;
  await applyDeviceProof(config);
  return config;
});

function handleApiError(error: unknown) {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const payload = error.response?.data as { code?: unknown } | undefined;
    if (payload?.code === 'session_locked') {
      dispatchPosSessionLocked();
      throw error;
    }
    // A device registration is permanent until explicit revocation.  A
    // rolling lease can expire while a terminal sleeps or stays offline, but
    // the session and device key must be kept so the signed renew flow can
    // recover without another QR pairing.
    if (payload?.code === 'device_lease_expired') {
      dispatchPosDeviceSecurityEvent('device_lease_expired');
      throw error;
    }
    // A replay response rejects only that duplicated request. It does not mean
    // the paired device key or the employee session became invalid, so forcing
    // a new PIN login would turn a harmless transport retry into an outage.
    if (payload?.code === 'device_replay_detected') {
      throw error;
    }
    if (isPosDeviceSecurityCode(payload?.code)) {
      persistSession(null);
      dispatchPosDeviceSecurityEvent(payload.code);
      throw error;
    }
    if (status === 401) {
      persistSession(null);
      if (
        typeof window !== 'undefined' &&
        !window.location.pathname.startsWith('/device-pairing') &&
        !window.location.pathname.startsWith('/pin-login')
      ) {
        window.location.replace('/pin-login');
      }
    }
  }
  throw error;
}

async function handleLocalResponseError(error: unknown) {
  if (axios.isAxiosError(error) && error.response) {
    await unprotectLocalAxiosResponse(error.response);
    const payload = error.response.data as { code?: unknown } | undefined;
    const config = error.config as (AxiosRequestConfig & { _edgeChannelRetried?: boolean }) | undefined;
    const baseURL = config?.baseURL || '';
    if (
      config &&
      baseURL !== resolveRemoteApiBaseUrl() &&
      !config._edgeChannelRetried &&
      ['secure_channel_invalid', 'secure_channel_required'].includes(String(payload?.code || ''))
    ) {
      config._edgeChannelRetried = true;
      const origin = new URL(baseURL, window.location.origin).origin;
      if ((await resetLocalAxiosRequestForRetry(config)) && (await ensureLocalAgentSecureChannel(origin, '', true))) {
        return apiClient.request(config);
      }
    }
  }
  return handleApiError(error);
}

apiClient.interceptors.response.use(
  (response) => unprotectLocalAxiosResponse(response),
  (error) => handleLocalResponseError(error),
);
publicApiClient.interceptors.response.use(
  (response) => unprotectLocalAxiosResponse(response),
  (error) => handleLocalResponseError(error),
);
remoteApiClient.interceptors.response.use(
  (response) => response,
  (error) => handleApiError(error),
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

export async function apiGetRemote<T>(url: string, config?: AxiosRequestConfig) {
  const response = await remoteApiClient.get<T>(url, config);
  return response.data;
}

export async function apiPost<T>(url: string, payload?: unknown, config?: AxiosRequestConfig) {
  if (isFinancialMutation(url)) {
    return executeFinancialCommand<T>(url, payload, financialTransport(config));
  }
  const response = await apiClient.post<T>(url, payload, config);
  return response.data;
}

function financialTransport(config?: AxiosRequestConfig) {
  return {
    get: apiGet,
    post: async <T>(url: string, payload: unknown, commandId: string) => {
      const response = await apiClient.post<T>(url, payload, {
        ...config,
        headers: { ...config?.headers, 'X-Edge-Operation-ID': commandId },
      });
      return response.data;
    },
  };
}

export function apiRecoverFinancialCommand<T>(url: string, allowRetry = false) {
  return recoverFinancialCommand<T>(url, financialTransport(), allowRetry);
}

export async function apiPatch<T>(url: string, payload?: unknown) {
  const response = await apiClient.patch<T>(url, payload);
  return response.data;
}

export async function apiDelete<T = void>(url: string, data?: unknown) {
  const response = await (data === undefined ? apiClient.delete<T>(url) : apiClient.delete<T>(url, { data }));
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
