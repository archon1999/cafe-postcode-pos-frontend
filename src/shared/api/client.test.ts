// @vitest-environment jsdom

import { webcrypto } from 'node:crypto';

import { AxiosError, type AxiosRequestConfig, type AxiosResponse } from 'axios';
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';

import {
  clearStoredDeviceIdentity,
  createPosDeviceIdentity,
  persistDeviceIdentity,
  persistSession,
  POS_SESSION_LOCK_EVENT,
  readStoredSession,
} from 'modules/auth/data-access';

import { apiGetRemotePublic, apiPostRemote, remoteApiClient, remotePublicApiClient } from './client';
import { TRANSPORT_STORAGE_KEY } from './edgeConnection';

describe('remote public API client', () => {
  const originalAdapter = remotePublicApiClient.defaults.adapter;
  const originalAuthenticatedAdapter = remoteApiClient.defaults.adapter;

  afterEach(async () => {
    remotePublicApiClient.defaults.adapter = originalAdapter;
    remoteApiClient.defaults.adapter = originalAuthenticatedAdapter;
    window.localStorage.clear();
    window.sessionStorage.clear();
    await clearStoredDeviceIdentity().catch(() => undefined);
  });

  it('bypasses a saved local-agent transport for TV requests', async () => {
    window.localStorage.setItem(
      TRANSPORT_STORAGE_KEY,
      JSON.stringify({
        mode: 'local',
        restaurantId: 'restaurant-1',
        origin: 'http://127.0.0.1:18181',
        secureChannel: true,
        selectedAt: new Date().toISOString(),
      }),
    );

    let requestConfig: AxiosRequestConfig | undefined;
    remotePublicApiClient.defaults.adapter = async (config) => {
      requestConfig = config;
      return {
        data: { ok: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      } as AxiosResponse;
    };

    await apiGetRemotePublic('/pos/monitor/tv-kitchen-queue/', { headers: { 'X-TV-Token': 'tv-token' } });

    expect(requestConfig?.baseURL).not.toContain('127.0.0.1:18181');
    expect(requestConfig?.headers?.['X-Edge-Token']).toBeUndefined();
    expect(requestConfig?.headers?.['X-TV-Token']).toBe('tv-token');
  });

  it('sends the employee session to the remote backend without the edge token', async () => {
    Object.defineProperty(window, 'crypto', { configurable: true, value: webcrypto });
    const identity = await createPosDeviceIdentity();
    await persistDeviceIdentity({
      ...identity,
      device: {
        id: '11111111-1111-4111-8111-111111111111',
        type: 'POS_TERMINAL',
        name: 'Test POS',
        status: 'ACTIVE',
        leaseExpiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
      restaurantContext: { restaurantId: 'restaurant-1', restaurantName: 'Restaurant' },
    });
    window.localStorage.setItem(
      TRANSPORT_STORAGE_KEY,
      JSON.stringify({
        mode: 'local',
        restaurantId: 'restaurant-1',
        origin: 'http://127.0.0.1:18181',
        secureChannel: true,
        selectedAt: new Date().toISOString(),
      }),
    );
    persistSession({
      token: 'employee-token',
      user: { id: 'user-1', username: 'manager', fullName: 'Manager', permissionCodes: [] },
    });

    let requestConfig: AxiosRequestConfig | undefined;
    remoteApiClient.defaults.adapter = async (config) => {
      requestConfig = config;
      return { data: { ok: true }, status: 200, statusText: 'OK', headers: {}, config } as AxiosResponse;
    };

    await apiPostRemote('/pos/monitor/tv-pairings/pairing-1/claim/', { claimToken: 'claim-token' });

    expect(requestConfig?.baseURL).not.toContain('127.0.0.1:18181');
    expect(requestConfig?.headers?.Authorization).toBe('Token employee-token');
    expect(requestConfig?.headers?.['X-Edge-Token']).toBeUndefined();
    expect(requestConfig?.headers?.['X-Device-Id']).toBe('11111111-1111-4111-8111-111111111111');
    expect(requestConfig?.headers?.['X-Device-Signature']).toEqual(expect.any(String));
  });

  it('keeps the user and device session when only the rolling device lease expired', async () => {
    Object.defineProperty(window, 'crypto', { configurable: true, value: webcrypto });
    const identity = await createPosDeviceIdentity();
    await persistDeviceIdentity({
      ...identity,
      device: {
        id: '11111111-1111-4111-8111-111111111111',
        type: 'POS_TERMINAL',
        name: 'Sleeping POS',
        status: 'ACTIVE',
        leaseExpiresAt: new Date(Date.now() - 60_000).toISOString(),
      },
      restaurantContext: { restaurantId: 'restaurant-1', restaurantName: 'Restaurant' },
    });
    persistSession({
      token: 'employee-token',
      user: { id: 'user-1', username: 'manager', fullName: 'Manager', permissionCodes: [] },
    });
    remoteApiClient.defaults.adapter = async (config) => {
      throw new AxiosError('expired lease', 'ERR_BAD_REQUEST', config, undefined, {
        data: { code: 'device_lease_expired' },
        status: 401,
        statusText: 'Unauthorized',
        headers: {},
        config,
      });
    };

    await expect(apiPostRemote('/pos/sales/orders/', {})).rejects.toBeInstanceOf(AxiosError);

    expect(readStoredSession()?.token).toBe('employee-token');
  });

  it('turns an exact session_locked response into a synchronous lock signal without clearing the token', async () => {
    persistSession({
      token: 'employee-token',
      user: { id: 'user-1', username: 'manager', fullName: 'Manager', permissionCodes: [] },
    });
    let lockedAt = '';
    const handleLock = (event: Event) => {
      lockedAt = (event as CustomEvent<{ lockedAt: string }>).detail.lockedAt;
    };
    window.addEventListener(POS_SESSION_LOCK_EVENT, handleLock);
    remoteApiClient.defaults.adapter = async (config) => {
      throw new AxiosError('locked', 'ERR_BAD_REQUEST', config, undefined, {
        data: { code: 'session_locked', detail: 'POS session is locked.' },
        status: 401,
        statusText: 'Unauthorized',
        headers: {},
        config,
      });
    };

    try {
      await expect(apiPostRemote('/pos/sales/orders/', {})).rejects.toBeInstanceOf(AxiosError);
    } finally {
      window.removeEventListener(POS_SESSION_LOCK_EVENT, handleLock);
    }

    expect(Date.parse(lockedAt)).not.toBeNaN();
    expect(readStoredSession()).toMatchObject({ token: 'employee-token', lockedAt });
  });
});
