// @vitest-environment jsdom

import { webcrypto } from 'node:crypto';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, waitFor } from '@testing-library/react';
import { AxiosError, type AxiosResponse } from 'axios';
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';

import {
  clearStoredDeviceIdentity,
  createPosDeviceIdentity,
  persistDeviceIdentity,
  persistSession,
  readStoredSession,
} from 'modules/auth/data-access';
import { base64UrlToBytes } from 'modules/auth/data-access/device/device-proof';
import { apiClient } from 'shared/api/client';

import { systemHealthQueryKey, useSystemHealthQuery } from './queries';

const originalAdapter = apiClient.defaults.adapter;
let queryClient: QueryClient;

afterEach(async () => {
  cleanup();
  queryClient?.clear();
  apiClient.defaults.adapter = originalAdapter;
  await clearStoredDeviceIdentity();
  localStorage.clear();
  sessionStorage.clear();
});

function StatusProbe() {
  useSystemHealthQuery({ enabled: true });
  return null;
}

describe('phone login followed by background status polling', () => {
  it.each(['waiter', 'cashier'])('keeps the %s session and signs the final cloud route on every poll', async (role) => {
    Object.defineProperty(window, 'crypto', { configurable: true, value: webcrypto });
    const identity = await createPosDeviceIdentity();
    await persistDeviceIdentity({
      ...identity,
      device: {
        id: '11111111-1111-4111-8111-111111111111',
        type: 'POS_TERMINAL',
        name: 'Test phone',
        status: 'ACTIVE',
        leaseExpiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      },
      restaurantContext: { restaurantId: 'restaurant-1', restaurantName: 'Test' },
    });
    persistSession({
      token: 'fresh-phone-token',
      user: { id: role, username: role, fullName: role, permissionCodes: ['pos_halls.view'] },
    });
    const publicKey = await crypto.subtle.importKey(
      'spki',
      base64UrlToBytes(identity.publicKey),
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    );
    let polls = 0;
    apiClient.defaults.adapter = async (config) => {
      // Reproduce the production failure: the slashless request redirects;
      // the redirected phone request is rejected before status is returned.
      if (config.url !== '/system/status/') {
        throw new AxiosError('Redirected status rejected', 'ERR_BAD_REQUEST', config, undefined, {
          config,
          status: 401,
          statusText: 'Unauthorized',
          headers: {},
          data: { detail: 'Unauthorized' },
        } as AxiosResponse);
      }
      expect(config.headers.Authorization).toBe('Token fresh-phone-token');
      const canonical = [
        'v1',
        'GET',
        '/api/v1/system/status/',
        config.headers.get('X-Device-Id'),
        config.headers.get('X-Device-Timestamp'),
        config.headers.get('X-Device-Nonce'),
        config.headers.get('X-Device-Content-SHA256'),
      ].join('\n');
      expect(
        await crypto.subtle.verify(
          { name: 'ECDSA', hash: 'SHA-256' },
          publicKey,
          base64UrlToBytes(String(config.headers.get('X-Device-Signature'))),
          new TextEncoder().encode(canonical),
        ),
      ).toBe(true);
      polls += 1;
      return {
        config,
        status: 200,
        statusText: 'OK',
        headers: {},
        data: { ok: true, status: { agent: { online: false } } },
      };
    };
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <StatusProbe />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(queryClient.getQueryState(systemHealthQueryKey)?.status).toBe('success'));
    await queryClient.refetchQueries({ queryKey: systemHealthQueryKey });
    expect(polls).toBe(2);
    expect(readStoredSession()?.token).toBe('fresh-phone-token');
    expect(readStoredSession()?.lockedAt).toBeUndefined();
  });
});
