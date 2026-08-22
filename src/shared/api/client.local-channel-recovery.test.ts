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
    window.localStorage.clear();
    window.sessionStorage.clear();
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
