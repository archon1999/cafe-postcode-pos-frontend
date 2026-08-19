// @vitest-environment jsdom

import { webcrypto } from 'node:crypto';

import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearStoredDeviceIdentity,
  createPosDeviceIdentity,
  persistDeviceIdentity,
  readStoredDeviceIdentity,
  resetDeviceIdentityDatabaseForTests,
  sha256Hex,
  base64UrlToBytes,
} from '../device';

import { authRepository } from './auth.repository.impl';

const apiMocks = vi.hoisted(() => ({
  getRemote: vi.fn(),
  post: vi.fn(),
  postRemote: vi.fn(),
  postRemotePublic: vi.fn(),
}));
const edgeMocks = vi.hoisted(() => ({
  readLegacyEdgeMigrationCredential: vi.fn(),
  readTransportConnection: vi.fn(),
}));
const secureChannelMocks = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock('shared/api/client', () => ({
  apiGetRemote: (...args: unknown[]) => apiMocks.getRemote(...args),
  apiPost: (...args: unknown[]) => apiMocks.post(...args),
  apiPostRemote: (...args: unknown[]) => apiMocks.postRemote(...args),
  apiPostRemotePublic: (...args: unknown[]) => apiMocks.postRemotePublic(...args),
}));

vi.mock('shared/api/edgeConnection', () => ({
  readLegacyEdgeMigrationCredential: () => edgeMocks.readLegacyEdgeMigrationCredential(),
  readOrCreateEdgeTerminalIdentity: () => ({ terminalId: 'pos-terminal-legacy', terminalName: 'Legacy POS' }),
  readTransportConnection: () => edgeMocks.readTransportConnection(),
}));

vi.mock('shared/api/edgeSecureChannel', () => ({
  secureLocalJSONRequest: (...args: unknown[]) => secureChannelMocks.request(...args),
}));

const activeDevice = {
  id: '11111111-1111-4111-8111-111111111111',
  type: 'POS_TERMINAL' as const,
  name: 'Test POS',
  status: 'ACTIVE' as const,
  leaseExpiresAt: '2030-08-16T12:00:00.000Z',
};
const restaurantContext = { restaurantId: 'restaurant-1', restaurantName: 'Test Cafe' };

beforeEach(() => {
  Object.defineProperty(window, 'crypto', { configurable: true, value: webcrypto });
  Object.values(apiMocks).forEach((mock) => mock.mockReset());
  Object.values(edgeMocks).forEach((mock) => mock.mockReset());
  secureChannelMocks.request.mockReset();
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(async () => {
  await clearStoredDeviceIdentity().catch(() => undefined);
  resetDeviceIdentityDatabaseForTests();
  vi.unstubAllGlobals();
});

describe('POS device auth repository', () => {
  it('creates a one-time QR pairing request without a restaurant code', async () => {
    apiMocks.postRemotePublic.mockResolvedValue({
      id: 'pairing-1',
      pollToken: 'poll-secret',
      claimToken: 'claim-secret',
      displayCode: '482193',
      expiresAt: '2030-08-16T12:05:00.000Z',
      status: 'pending',
    });

    const pairing = await authRepository.createDevicePairing();

    expect(pairing).toMatchObject({ id: 'pairing-1', status: 'PENDING', displayCode: '482193' });
    expect(apiMocks.postRemotePublic).toHaveBeenCalledWith(
      '/devices/pairings/',
      expect.objectContaining({
        deviceType: 'POS_TERMINAL',
        publicKeyAlgorithm: 'P256_SHA256',
        publicKey: expect.any(String),
        keyProof: { nonce: expect.any(String), signature: expect.any(String) },
      }),
    );
    expect(JSON.stringify(apiMocks.postRemotePublic.mock.calls[0])).not.toContain('restaurantCode');
    expect((await readStoredDeviceIdentity())?.privateKey.extractable).toBe(false);
  });

  it('never exposes an upstream HTML error page in the pairing UI', async () => {
    apiMocks.postRemotePublic.mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 502,
        data: '<!doctype html><html><body>proxy implementation details</body></html>',
      },
    });

    await expect(authRepository.createDevicePairing()).rejects.toMatchObject({
      message: 'Qurilmani ulash so‘rovini yaratib bo‘lmadi.',
      status: 502,
    });
  });

  it('preserves secret polling state while pending and atomically stores the approved binding', async () => {
    const identity = await createPosDeviceIdentity();
    await persistDeviceIdentity({
      ...identity,
      pairing: {
        id: 'pairing-1',
        pollToken: 'poll-secret',
        claimToken: 'claim-secret',
        displayCode: '482193',
        expiresAt: '2030-08-16T12:05:00.000Z',
        status: 'PENDING',
      },
    });
    apiMocks.postRemotePublic
      .mockResolvedValueOnce({ status: 'pending' })
      .mockResolvedValueOnce({ status: 'paired', device: activeDevice, restaurantContext });

    await expect(authRepository.readDevicePairingStatus()).resolves.toMatchObject({
      pollToken: 'poll-secret',
      claimToken: 'claim-secret',
      status: 'PENDING',
    });
    await expect(authRepository.readDevicePairingStatus()).resolves.toEqual({
      device: activeDevice,
      restaurantContext,
    });
    const stored = await readStoredDeviceIdentity();
    expect(stored?.device).toEqual(activeDevice);
    expect(stored?.restaurantContext).toEqual(restaurantContext);
    expect(stored?.pairing).toBeUndefined();
  });

  it('silently migrates only with a same-restaurant Local Agent attestation bound to the new public key', async () => {
    const channelKeys = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
    const sessionKey = await crypto.subtle.importKey('raw', new Uint8Array(32).fill(7), 'AES-GCM', false, [
      'encrypt',
      'decrypt',
    ]);
    localStorage.setItem('cafe-pos.edge-token', 'existing-edge-token');
    edgeMocks.readTransportConnection.mockReturnValue({
      mode: 'local',
      restaurantId: 'restaurant-1',
      origin: 'http://127.0.0.1:18181',
    });
    edgeMocks.readLegacyEdgeMigrationCredential.mockReturnValue('existing-edge-token');
    secureChannelMocks.request.mockImplementation(
      async (
        _origin: string,
        _path: string,
        payload: { publicKey: string; publicKeyAlgorithm: string; terminalId: string },
      ) => {
        expect(payload.publicKeyAlgorithm).toBe('P256_SHA256');
        const current = await readStoredDeviceIdentity();
        if (!current) throw new Error('migration identity was not persisted');
        await persistDeviceIdentity({
          ...current,
          localSecureChannel: {
            version: 1,
            clientPrivateKey: channelKeys.privateKey,
            clientPublicKey: 'client-public-key',
            terminalId: payload.terminalId,
            origin: 'http://127.0.0.1:18181',
            agentPublicKey: 'agent-public-key',
            agentPublicKeyFingerprint: 'a'.repeat(64),
            sessionKey,
            channelId: 'channel-after-migration',
            expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
          },
        });
        localStorage.removeItem('cafe-pos.edge-token');
        return {
          ok: true,
          status: 201,
          data: {
            version: 'v1',
            restaurantId: 'restaurant-1',
            localAgentDeviceId: 'agent-1',
            terminalId: payload.terminalId,
            publicKeyFingerprint: await sha256Hex(base64UrlToBytes(payload.publicKey)),
            issuedAt: '1786881600',
            expiresAt: '1786881900',
            nonce: 'agent-nonce',
            signature: 'agent-signature',
          },
        };
      },
    );
    apiMocks.postRemotePublic.mockResolvedValue({ device: activeDevice, restaurantContext });

    await expect(authRepository.tryLegacyDeviceMigration()).resolves.toEqual({
      device: activeDevice,
      restaurantContext,
    });

    expect(secureChannelMocks.request).toHaveBeenCalledWith(
      'http://127.0.0.1:18181',
      '/v1/pos/devices/migration-attestation',
      expect.objectContaining({ publicKeyAlgorithm: 'P256_SHA256', terminalId: 'pos-terminal-legacy' }),
      'existing-edge-token',
    );
    expect(apiMocks.postRemotePublic).toHaveBeenCalledWith(
      '/devices/legacy-pos-migration/',
      expect.objectContaining({
        publicKey: expect.any(String),
        agentAttestation: expect.objectContaining({ restaurantId: 'restaurant-1' }),
      }),
    );
    expect(JSON.stringify(apiMocks.postRemotePublic.mock.calls[0])).not.toContain('authCode');
    const stored = await readStoredDeviceIdentity();
    expect(stored?.localSecureChannel).toMatchObject({
      terminalId: 'pos-terminal-legacy',
      channelId: 'channel-after-migration',
      origin: 'http://127.0.0.1:18181',
    });
    expect(stored?.localSecureChannel?.sessionKey?.extractable).toBe(false);
    expect(localStorage.getItem('cafe-pos.edge-token')).toBeNull();

    apiMocks.post.mockImplementationOnce(async () => {
      expect((await readStoredDeviceIdentity())?.localSecureChannel?.channelId).toBe('channel-after-migration');
      return { token: 'session-token', user: { id: 'user-1', username: 'cashier', permissionCodes: [] } };
    });
    await expect(authRepository.loginWithPin({ pin: '6221' })).resolves.toMatchObject({ token: 'session-token' });
    expect(apiMocks.post).toHaveBeenCalledWith('/pos/auth/pin-login/', { pin: '6221' });
  });

  it('refuses silent migration when no authenticated Local Agent attestation exists', async () => {
    edgeMocks.readTransportConnection.mockReturnValue({ mode: 'remote', restaurantId: 'restaurant-1' });

    await expect(authRepository.tryLegacyDeviceMigration()).resolves.toBeNull();
    expect(apiMocks.postRemotePublic).not.toHaveBeenCalled();
  });

  it('derives PIN login from device proof and never sends restaurantId', async () => {
    apiMocks.post.mockResolvedValue({
      token: 'session-token',
      user: { id: 'user-1', username: 'cashier', fullName: 'Cashier', permissionCodes: [] },
    });

    await authRepository.loginWithPin({ pin: '1234' });

    expect(apiMocks.post).toHaveBeenCalledWith('/pos/auth/pin-login/', { pin: '1234' });
  });

  it('renews a near-expiry lease before loading authoritative restaurant context', async () => {
    const identity = await createPosDeviceIdentity();
    await persistDeviceIdentity({
      ...identity,
      device: { ...activeDevice, leaseExpiresAt: new Date(Date.now() + 5 * 60_000).toISOString() },
      restaurantContext: { restaurantId: 'stale', restaurantName: 'Stale' },
    });
    apiMocks.postRemote.mockResolvedValue({ leaseExpiresAt: '2030-08-16T12:00:00.000Z' });
    apiMocks.getRemote.mockResolvedValue({ device: activeDevice, restaurantContext });

    await expect(authRepository.restoreDeviceBinding()).resolves.toEqual({ device: activeDevice, restaurantContext });
    expect(apiMocks.postRemote).toHaveBeenCalledWith('/devices/lease/renew/', {});
    expect(apiMocks.getRemote).toHaveBeenCalledWith('/devices/me/');
  });
});
