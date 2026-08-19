// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { persistSession } from 'modules/auth/data-access/storage/session.storage';

import { persistTransportConnection, readTransportConnection } from './edgeConnection';
import { refreshTransportMode } from './transportResolver';

const apiPostRemoteMock = vi.hoisted(() => vi.fn());
const secureChannelMock = vi.hoisted(() => vi.fn());
vi.mock('./client', () => ({ apiPostRemote: (...args: unknown[]) => apiPostRemoteMock(...args) }));
vi.mock('./edgeSecureChannel', () => ({
  ensureLocalAgentSecureChannel: (...args: unknown[]) => secureChannelMock(...args),
  readBoundedJSONResponse: (response: Response) => response.json(),
}));

describe('paired-device transport resolver', () => {
  const fetchMock = () => vi.mocked(fetch);

  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    apiPostRemoteMock.mockReset();
    secureChannelMock.mockReset();
    secureChannelMock.mockResolvedValue(true);
    vi.stubGlobal('fetch', vi.fn());
  });

  it('refreshes a tokenless loopback connection without falling back to remote', async () => {
    persistTransportConnection({
      mode: 'local',
      restaurantId: 'new-york',
      origin: 'http://127.0.0.1:18181',
      backendOnline: true,
    });
    fetchMock().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ protocolVersion: 1 }),
    } as Response);

    const result = await refreshTransportMode();

    expect(result).toMatchObject({ mode: 'local', requiresRelogin: false });
    expect(readTransportConnection()).toMatchObject({ mode: 'local', restaurantId: 'new-york' });
  });

  it('refreshes a remote paired session to a matching router agent and requires a new PIN session', async () => {
    persistTransportConnection({ mode: 'remote', restaurantId: 'new-york', backendOnline: true });
    persistSession({
      token: 'pos-session',
      user: { id: 'user-1', username: 'cashier', fullName: 'Cashier', permissionCodes: [] },
      restaurantContext: { restaurantId: 'new-york', restaurantName: 'New York' },
    });
    apiPostRemoteMock.mockResolvedValueOnce({
      restaurantId: 'new-york',
      coordinator: {
        restaurantId: 'new-york',
        coordinatorUrls: ['http://192.168.1.30:18181'],
        agentDeviceId: '22222222-2222-4222-8222-222222222222',
        agentSigningPublicKeyAlgorithm: 'ED25519',
        agentSigningPublicKey: 'A'.repeat(43),
        agentSigningPublicKeyFingerprint: 'a'.repeat(64),
      },
    });
    fetchMock()
      .mockRejectedValueOnce(new Error('loopback unavailable'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ protocolVersion: 1 }),
      } as Response);

    const result = await refreshTransportMode();

    expect(result).toEqual({ changed: true, requiresRelogin: true, mode: 'router' });
    expect(readTransportConnection()).toMatchObject({
      mode: 'router',
      restaurantId: 'new-york',
      origin: 'http://192.168.1.30:18181',
    });
    expect(secureChannelMock).toHaveBeenCalledWith(
      'http://192.168.1.30:18181',
      '',
      true,
      expect.objectContaining({ agentDeviceId: '22222222-2222-4222-8222-222222222222' }),
      'new-york',
    );
  });

  it('falls back from a mismatched local agent to remote and requires a new PIN session', async () => {
    persistTransportConnection({
      mode: 'local',
      restaurantId: 'new-york',
      origin: 'http://127.0.0.1:18181',
      backendOnline: true,
    });
    secureChannelMock.mockResolvedValueOnce(false);
    fetchMock().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ protocolVersion: 1 }),
    } as Response);

    const result = await refreshTransportMode();

    expect(result).toEqual({ changed: true, requiresRelogin: true, mode: 'remote' });
    expect(readTransportConnection()).toMatchObject({ mode: 'remote', restaurantId: 'new-york' });
  });
});
