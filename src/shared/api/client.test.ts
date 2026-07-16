// @vitest-environment jsdom

import type { AxiosRequestConfig, AxiosResponse } from 'axios';
import { afterEach, describe, expect, it } from 'vitest';

import { persistSession } from 'modules/auth/data-access';

import { apiGetRemotePublic, apiPostRemote, remoteApiClient, remotePublicApiClient } from './client';
import { TRANSPORT_STORAGE_KEY } from './edgeConnection';

describe('remote public API client', () => {
  const originalAdapter = remotePublicApiClient.defaults.adapter;
  const originalAuthenticatedAdapter = remoteApiClient.defaults.adapter;

  afterEach(() => {
    remotePublicApiClient.defaults.adapter = originalAdapter;
    remoteApiClient.defaults.adapter = originalAuthenticatedAdapter;
    window.localStorage.clear();
  });

  it('bypasses a saved local-agent transport for TV requests', async () => {
    window.localStorage.setItem(
      TRANSPORT_STORAGE_KEY,
      JSON.stringify({
        mode: 'local',
        restaurantId: 'restaurant-1',
        origin: 'http://127.0.0.1:18181',
        token: 'edge-token',
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
    window.localStorage.setItem(
      TRANSPORT_STORAGE_KEY,
      JSON.stringify({
        mode: 'local',
        restaurantId: 'restaurant-1',
        origin: 'http://127.0.0.1:18181',
        token: 'edge-token',
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
  });
});
