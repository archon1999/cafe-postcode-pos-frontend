// @vitest-environment jsdom

import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { persistSession, readStoredSession } from 'modules/auth/data-access';

const secureChannelMocks = vi.hoisted(() => ({
  ensure: vi.fn(async () => true),
  protect: vi.fn(async (config) => config),
  reset: vi.fn(async () => true),
  unprotect: vi.fn(async (response) => response),
}));
const recoverAddressMock = vi.hoisted(() => vi.fn());
vi.mock('./transportResolver', () => ({ recoverLocalAgentConnection: recoverAddressMock }));

vi.mock('./edgeSecureChannel', () => ({
  ensureLocalAgentSecureChannel: secureChannelMocks.ensure,
  protectLocalAxiosRequest: secureChannelMocks.protect,
  resetLocalAxiosRequestForRetry: secureChannelMocks.reset,
  unprotectLocalAxiosResponse: secureChannelMocks.unprotect,
}));

import { apiClient, apiPost } from './client';
import { persistTransportConnection } from './edgeConnection';

describe('Local Agent channel restart recovery', () => {
  const originalAdapter = apiClient.defaults.adapter;

  afterEach(() => {
    apiClient.defaults.adapter = originalAdapter;
    secureChannelMocks.ensure.mockClear();
    secureChannelMocks.protect.mockClear();
    secureChannelMocks.reset.mockClear();
    secureChannelMocks.unprotect.mockClear();
    recoverAddressMock.mockReset();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  function movedRouter() {
    persistTransportConnection({
      mode: 'router',
      restaurantId: 'restaurant-1',
      origin: 'http://192.168.1.15:18181',
      secureChannel: true,
      backendOnline: true,
    });
    recoverAddressMock.mockImplementation(async () => {
      persistTransportConnection({
        mode: 'router',
        restaurantId: 'restaurant-1',
        origin: 'http://192.168.1.4:18181',
        secureChannel: true,
        backendOnline: true,
      });
      return true;
    });
  }

  it('recovers a handshake timeout before sending PIN to the new address exactly once', async () => {
    movedRouter();
    secureChannelMocks.protect.mockRejectedValueOnce(new DOMException('aborted', 'AbortError'));
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => ({
      data: { token: 'session' },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    }));
    apiClient.defaults.adapter = adapter;
    await expect(apiPost('/pos/auth/pin-login/', { pin: '1234' })).resolves.toEqual({ token: 'session' });
    expect(recoverAddressMock).toHaveBeenCalledWith('http://192.168.1.15:18181', 'restaurant-1');
    expect(adapter).toHaveBeenCalledTimes(1);
    expect(adapter.mock.calls[0][0].baseURL).toContain('192.168.1.4:18181');
    expect(adapter.mock.calls[0][0].timeout).toBe(15_000);
  });

  it.each(['get', 'pin'])('recovers and retries a %s request once after a network failure', async (kind) => {
    movedRouter();
    let attempts = 0;
    apiClient.defaults.adapter = async (config) => {
      attempts++;
      if (attempts === 1) throw new AxiosError('network failure', 'ERR_NETWORK', config);
      expect(config.baseURL).toContain('192.168.1.4:18181');
      return { data: { ok: true }, status: 200, statusText: 'OK', headers: {}, config };
    };
    const request = kind === 'get' ? apiClient.get('/pos/orders/') : apiPost('/pos/auth/pin-login/', { pin: '1234' });
    await request;
    expect(attempts).toBe(2);
    expect(recoverAddressMock).toHaveBeenCalledTimes(1);
    expect(secureChannelMocks.reset).toHaveBeenCalledTimes(1);
  });

  it('repairs the address without replaying an order mutation with an unknown outcome', async () => {
    movedRouter();
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
      throw new AxiosError('network failure', 'ERR_NETWORK', config);
    });
    apiClient.defaults.adapter = adapter;
    await expect(apiPost('/pos/orders/123/items/', { quantity: 1 })).rejects.toThrow('network failure');
    expect(adapter).toHaveBeenCalledTimes(1);
    expect(recoverAddressMock).toHaveBeenCalledTimes(1);
    expect(secureChannelMocks.reset).not.toHaveBeenCalled();
  });

  it('does not retry a cancelled request', async () => {
    movedRouter();
    apiClient.defaults.adapter = async (config) => {
      throw new AxiosError('cancelled', 'ERR_CANCELED', config);
    };
    await expect(apiClient.get('/pos/orders/')).rejects.toThrow('cancelled');
    expect(recoverAddressMock).not.toHaveBeenCalled();
  });

  it('rediscovers the Agent when the old IP now rejects the saved channel', async () => {
    movedRouter();
    secureChannelMocks.ensure.mockResolvedValueOnce(false);
    let attempts = 0;
    apiClient.defaults.adapter = async (config) => {
      if (++attempts === 1)
        throw new AxiosError('wrong channel', 'ERR_BAD_REQUEST', config, undefined, {
          data: { code: 'secure_channel_invalid' },
          status: 401,
          statusText: 'Unauthorized',
          headers: {},
          config,
        });
      expect(config.baseURL).toContain('192.168.1.4:18181');
      return { data: { ok: true }, status: 200, statusText: 'OK', headers: {}, config };
    };
    await apiClient.get('/pos/orders/');
    expect(attempts).toBe(2);
    expect(recoverAddressMock).toHaveBeenCalledTimes(1);
  });

  it('renews and retries transparently without clearing the cashier session', async () => {
    persistTransportConnection({
      mode: 'local',
      restaurantId: 'restaurant-1',
      origin: 'http://127.0.0.1:18181',
      secureChannel: true,
      backendOnline: true,
    });
    persistSession({
      token: 'employee-session',
      user: { id: 'user-1', username: 'cashier', fullName: 'Cashier', permissionCodes: [] },
    });
    let attempts = 0;
    apiClient.defaults.adapter = async (config) => {
      attempts += 1;
      if (attempts === 1) {
        throw new AxiosError('stale channel', 'ERR_BAD_REQUEST', config, undefined, {
          data: { code: 'secure_channel_invalid' },
          status: 401,
          statusText: 'Unauthorized',
          headers: {},
          config: config as InternalAxiosRequestConfig,
        });
      }
      return {
        data: { ok: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      } as AxiosResponse<{ ok: boolean }>;
    };

    await expect(apiPost<{ ok: boolean }>('/pos/auth/session/validate/', {})).resolves.toEqual({ ok: true });

    expect(attempts).toBe(2);
    expect(secureChannelMocks.reset).toHaveBeenCalledTimes(1);
    expect(secureChannelMocks.ensure).toHaveBeenCalledWith('http://127.0.0.1:18181', '', true);
    expect(readStoredSession()?.token).toBe('employee-session');
    expect(window.location.pathname).not.toBe('/pin-login');
  });
});
