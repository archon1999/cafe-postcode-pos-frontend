// @vitest-environment jsdom

import { AxiosError } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { persistSession, readStoredSession } from 'modules/auth/data-access/storage/session.storage';

import { persistTransportConnection, readTransportConnection } from './edgeConnection';
import { refreshTransportAndSync, refreshTransportMode } from './transportResolver';

const apiPostMock = vi.hoisted(() => vi.fn());
const apiPostRemoteMock = vi.hoisted(() => vi.fn());
const apiPostDeviceRemoteMock = vi.hoisted(() => vi.fn());
const secureChannelMock = vi.hoisted(() => vi.fn());
const readDeviceIdentityMock = vi.hoisted(() => vi.fn());
const updateDeviceIdentityMock = vi.hoisted(() => vi.fn());
vi.mock('modules/auth/data-access/device/device-identity.store', () => ({
  readStoredDeviceIdentity: (...args: unknown[]) => readDeviceIdentityMock(...args),
  updateStoredDeviceIdentity: (...args: unknown[]) => updateDeviceIdentityMock(...args),
}));
vi.mock('./client', () => ({
  apiPost: (...args: unknown[]) => apiPostMock(...args),
  apiPostRemote: (...args: unknown[]) => apiPostRemoteMock(...args),
  apiPostDeviceRemote: (...args: unknown[]) => apiPostDeviceRemoteMock(...args),
}));
vi.mock('./edgeSecureChannel', () => ({
  ensureLocalAgentSecureChannel: (...args: unknown[]) => secureChannelMock(...args),
  readBoundedJSONResponse: (response: Response) => response.json(),
}));

describe('paired-device transport resolver', () => {
  const fetchMock = () => vi.mocked(fetch);

  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    apiPostMock.mockReset();
    apiPostRemoteMock.mockReset();
    apiPostDeviceRemoteMock.mockReset();
    secureChannelMock.mockReset();
    readDeviceIdentityMock.mockReset();
    updateDeviceIdentityMock.mockReset();
    readDeviceIdentityMock.mockResolvedValue(null);
    secureChannelMock.mockResolvedValue(true);
    vi.stubGlobal('fetch', vi.fn());
  });

  function movedAgent(restaurantId: string) {
    persistTransportConnection({
      mode: 'router',
      restaurantId,
      origin: 'http://192.168.1.15:18181',
      secureChannel: true,
      backendOnline: true,
    });
    readDeviceIdentityMock.mockResolvedValue({
      device: { id: 'pos-1', status: 'ACTIVE' },
      restaurantContext: { restaurantId },
    });
    apiPostDeviceRemoteMock.mockResolvedValue({
      restaurantId,
      coordinator: {
        restaurantId,
        coordinatorUrls: ['http://127.0.0.1:18181', 'http://192.168.1.4:18181'],
        agentDeviceId: 'agent-1',
        agentSigningPublicKeyAlgorithm: 'ED25519',
        agentSigningPublicKey: 'A'.repeat(43),
        agentSigningPublicKeyFingerprint: 'a'.repeat(64),
      },
    });
    fetchMock().mockImplementation(async (url) => {
      if (String(url) !== 'http://192.168.1.4:18181/health') throw new TypeError('Failed to fetch');
      return { ok: true, json: async () => ({ protocolVersion: 1 }) } as Response;
    });
  }

  it('rediscovers a changed LAN IP before PIN login using device proof and verifies Agent identity', async () => {
    movedAgent('tagi-prelogin');
    const result = await refreshTransportMode();
    expect(result).toEqual({ changed: true, requiresRelogin: false, mode: 'router' });
    expect(readTransportConnection()?.origin).toBe('http://192.168.1.4:18181');
    expect(apiPostDeviceRemoteMock).toHaveBeenCalledWith('/pos/auth/device-transport/', {}, { timeout: 8_000 });
    expect(secureChannelMock).toHaveBeenCalledWith(
      'http://192.168.1.4:18181',
      '',
      true,
      expect.objectContaining({ agentDeviceId: 'agent-1' }),
      'tagi-prelogin',
    );
    expect(apiPostRemoteMock).not.toHaveBeenCalled();
  });

  it('shares concurrent recovery and preserves an existing employee session', async () => {
    movedAgent('tagi-concurrent');
    persistSession({
      token: 'edge-session',
      user: { id: '1', username: 'cashier', fullName: 'Cashier', permissionCodes: [] },
      restaurantContext: { restaurantId: 'tagi-concurrent', restaurantName: 'Tagi' },
    });
    await Promise.all([refreshTransportMode(), refreshTransportMode(), refreshTransportMode()]);
    expect(apiPostDeviceRemoteMock).toHaveBeenCalledTimes(1);
    expect(readTransportConnection()?.origin).toBe('http://192.168.1.4:18181');
    expect(readStoredSession()?.token).toBe('edge-session');
  });

  it('renews an expired device lease once before retrying discovery', async () => {
    movedAgent('tagi-lease');
    apiPostDeviceRemoteMock
      .mockRejectedValueOnce(
        new AxiosError('expired', undefined, undefined, undefined, {
          data: { code: 'device_lease_expired' },
          status: 401,
          statusText: 'Unauthorized',
          headers: {},
          config: {} as never,
        }),
      )
      .mockResolvedValueOnce({ leaseExpiresAt: '2027-01-01T00:00:00Z' });
    await refreshTransportMode();
    expect(apiPostDeviceRemoteMock).toHaveBeenCalledTimes(3);
    expect(apiPostDeviceRemoteMock).toHaveBeenNthCalledWith(2, '/devices/lease/renew/', {}, { timeout: 8_000 });
    expect(readTransportConnection()?.origin).toBe('http://192.168.1.4:18181');
  });

  it.each(['server unavailable', 'wrong restaurant', 'untrusted agent'])(
    'keeps the old binding when %s',
    async (reason) => {
      movedAgent(`tagi-${reason}`);
      if (reason === 'server unavailable') apiPostDeviceRemoteMock.mockRejectedValue(new Error('offline'));
      if (reason === 'wrong restaurant') apiPostDeviceRemoteMock.mockResolvedValue({ restaurantId: 'other' });
      if (reason === 'untrusted agent') secureChannelMock.mockResolvedValue(false);
      await refreshTransportMode();
      expect(readTransportConnection()).toMatchObject({
        mode: 'router',
        origin: 'http://192.168.1.15:18181',
        backendOnline: false,
      });
      await refreshTransportMode();
      expect(apiPostDeviceRemoteMock).toHaveBeenCalledTimes(1);
    },
  );

  it('does not overwrite a device switched to another restaurant during discovery', async () => {
    movedAgent('tagi-race');
    secureChannelMock.mockImplementation(async () => {
      persistTransportConnection({ mode: 'remote', restaurantId: 'other', backendOnline: true });
      return true;
    });
    await refreshTransportMode();
    expect(readTransportConnection()).toMatchObject({ restaurantId: 'other', mode: 'remote' });
  });

  it('asks the selected Local Agent to recover fiscal work during a manual refresh', async () => {
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
    apiPostMock.mockResolvedValueOnce({ ok: true });

    const result = await refreshTransportAndSync();

    expect(result).toMatchObject({ mode: 'local', requiresRelogin: false });
    expect(apiPostMock).toHaveBeenCalledWith('/sync/refresh', {}, { timeout: 60_000 });
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

  it('upgrades a router connection to trusted loopback on the Agent host', async () => {
    persistTransportConnection({
      mode: 'router',
      restaurantId: 'garizon',
      origin: 'http://192.168.1.113:18181',
      secureChannel: true,
      backendOnline: true,
    });
    persistSession({
      token: 'pos-session',
      user: { id: 'user-1', username: 'cashier', fullName: 'Cashier', permissionCodes: [] },
      restaurantContext: { restaurantId: 'garizon', restaurantName: 'Garizon' },
    });
    fetchMock().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ protocolVersion: 1 }),
    } as Response);

    const result = await refreshTransportMode();

    expect(result).toEqual({ changed: true, requiresRelogin: false, mode: 'local' });
    expect(readTransportConnection()).toMatchObject({
      mode: 'local',
      restaurantId: 'garizon',
      origin: 'http://127.0.0.1:18181',
    });
    expect(secureChannelMock).toHaveBeenCalledWith('http://127.0.0.1:18181', '', true, undefined, 'garizon');
    expect(apiPostRemoteMock).not.toHaveBeenCalled();
  });

  it('keeps the working router connection when loopback upgrade is unavailable', async () => {
    persistTransportConnection({
      mode: 'router',
      restaurantId: 'garizon',
      origin: 'http://192.168.1.113:18181',
      secureChannel: true,
      backendOnline: true,
    });
    persistSession({
      token: 'pos-session',
      user: { id: 'user-1', username: 'cashier', fullName: 'Cashier', permissionCodes: [] },
      restaurantContext: { restaurantId: 'garizon', restaurantName: 'Garizon' },
    });
    fetchMock()
      .mockRejectedValueOnce(new Error('loopback unavailable'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ protocolVersion: 1 }),
      } as Response);

    const result = await refreshTransportMode();

    expect(result).toEqual({ changed: false, requiresRelogin: false, mode: 'router' });
    expect(readTransportConnection()).toMatchObject({
      mode: 'router',
      origin: 'http://192.168.1.113:18181',
    });
    expect(apiPostRemoteMock).not.toHaveBeenCalled();
  });

  it('recovers a missing transport record from the paired employee session before probing the agent', async () => {
    persistSession({
      token: 'pos-session',
      user: { id: 'user-1', username: 'cashier', fullName: 'Cashier', permissionCodes: [] },
      restaurantContext: { restaurantId: 'garizon', restaurantName: 'Garizon' },
    });
    apiPostRemoteMock.mockResolvedValueOnce({
      restaurantId: 'garizon',
      coordinator: {
        restaurantId: 'garizon',
        coordinatorUrls: ['http://127.0.0.1:18181'],
        agentDeviceId: '22222222-2222-4222-8222-222222222222',
        agentSigningPublicKeyAlgorithm: 'ED25519',
        agentSigningPublicKey: 'A'.repeat(43),
        agentSigningPublicKeyFingerprint: 'a'.repeat(64),
      },
    });
    fetchMock().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ protocolVersion: 1 }),
    } as Response);

    const result = await refreshTransportMode();

    expect(result).toEqual({ changed: true, requiresRelogin: true, mode: 'local' });
    expect(apiPostRemoteMock).toHaveBeenCalledWith(
      '/pos/auth/transport/',
      expect.objectContaining({ terminalId: expect.any(String) }),
      { timeout: 8_000 },
    );
    expect(readTransportConnection()).toMatchObject({
      mode: 'local',
      restaurantId: 'garizon',
      origin: 'http://127.0.0.1:18181',
    });
  });

  it('recovers an old migrated session without restaurant context from its paired device binding', async () => {
    persistSession({
      token: 'pos-session',
      user: { id: 'user-1', username: 'cashier', fullName: 'Cashier', permissionCodes: [] },
    });
    readDeviceIdentityMock.mockResolvedValueOnce({
      device: { id: 'terminal-1' },
      restaurantContext: { restaurantId: 'garizon', restaurantName: 'Garizon' },
    });
    apiPostRemoteMock.mockResolvedValueOnce({
      restaurantId: 'garizon',
      coordinator: {
        restaurantId: 'garizon',
        coordinatorUrls: ['http://127.0.0.1:18181'],
        agentDeviceId: '22222222-2222-4222-8222-222222222222',
        agentSigningPublicKeyAlgorithm: 'ED25519',
        agentSigningPublicKey: 'A'.repeat(43),
        agentSigningPublicKeyFingerprint: 'a'.repeat(64),
      },
    });
    fetchMock().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ protocolVersion: 1 }),
    } as Response);

    const result = await refreshTransportMode();

    expect(result).toEqual({ changed: true, requiresRelogin: true, mode: 'local' });
    expect(apiPostRemoteMock).toHaveBeenCalledWith(
      '/pos/auth/transport/',
      expect.objectContaining({ terminalId: expect.any(String) }),
      { timeout: 8_000 },
    );
    expect(readTransportConnection()).toMatchObject({
      mode: 'local',
      restaurantId: 'garizon',
      origin: 'http://127.0.0.1:18181',
    });
  });

  it('keeps edge transport sticky when the selected Local Agent is temporarily unavailable', async () => {
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

    expect(result).toEqual({ changed: false, requiresRelogin: false, mode: 'local' });
    expect(readTransportConnection()).toMatchObject({
      mode: 'local',
      restaurantId: 'new-york',
      origin: 'http://127.0.0.1:18181',
      backendOnline: false,
    });
    expect(apiPostRemoteMock).not.toHaveBeenCalled();
  });
});
