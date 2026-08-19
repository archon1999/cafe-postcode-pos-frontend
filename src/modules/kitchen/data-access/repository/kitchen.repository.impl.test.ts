// @vitest-environment jsdom

import { webcrypto } from 'node:crypto';

import 'fake-indexeddb/auto';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { base64UrlToBytes, sha256Hex } from 'modules/auth/data-access/device';
import { apiGetRemotePublic, apiPostRemotePublic, unwrapCollection } from 'shared/api/client';

import {
  clearStoredTvMonitorIdentity,
  readStoredTvMonitorIdentity,
  resetTvMonitorIdentityDatabaseForTests,
} from '../storage/tv-monitor-identity.store';
import { readLegacyTvMonitorCredential, readTvMonitorDevice } from '../storage/tv-monitor.storage';

import { kitchenRepository } from './kitchen.repository.impl';

vi.mock('shared/api/apiUrl', () => ({
  resolveRemoteApiBaseUrl: () => 'https://api.cafe-postcode.uz/api/v1',
}));
vi.mock('shared/api/client', () => ({
  apiGet: vi.fn(),
  apiGetRemotePublic: vi.fn(),
  apiPost: vi.fn(),
  apiPostRemote: vi.fn(),
  apiPostRemotePublic: vi.fn(),
  unwrapCollection: vi.fn((payload: unknown) =>
    Array.isArray(payload) ? payload : ((payload as { data?: unknown[] } | undefined)?.data ?? []),
  ),
}));

const restaurantContext = {
  restaurantId: 'restaurant-1',
  restaurantName: 'Qamish',
  posMonitorVariant: 'light_compact' as const,
};

const activeDevice = {
  id: 'a1111111-1111-4111-8111-111111111111',
  type: 'TV_MONITOR' as const,
  name: 'Kitchen TV',
  status: 'ACTIVE' as const,
  leaseExpiresAt: '2099-01-01T00:00:00.000Z',
};

function pairingResponse(claimUrl?: string) {
  return {
    id: 'pairing-1',
    pollToken: 'poll-token-with-enough-entropy-123456789',
    claimToken: 'claim-token-with-enough-entropy-1234567',
    claimUrl:
      claimUrl ||
      'https://admin.cafe-postcode.uz/pair#v=1&pairingId=pairing-1&claimToken=claim-token-with-enough-entropy-1234567',
    displayCode: '482913',
    expiresAt: '2099-01-01T00:00:00.000Z',
    status: 'pending',
  };
}

beforeAll(() => {
  Object.defineProperty(window, 'crypto', { configurable: true, value: webcrypto });
});

beforeEach(() => {
  window.localStorage.clear();
  delete window.CafePostcodeTv;
  vi.mocked(unwrapCollection).mockImplementation((payload) =>
    Array.isArray(payload) ? payload : (payload?.data ?? []),
  );
});

afterEach(async () => {
  await clearStoredTvMonitorIdentity().catch(() => undefined);
  resetTvMonitorIdentityDatabaseForTests();
  window.localStorage.clear();
  delete window.CafePostcodeTv;
  vi.clearAllMocks();
});

describe('generalized TV monitor device repository', () => {
  it('creates a non-exportable P-256 TV pairing and persists only the fragment claim URL', async () => {
    vi.mocked(apiPostRemotePublic).mockResolvedValueOnce(pairingResponse());

    const pairing = await kitchenRepository.createTvMonitorPairing();

    const [, payload] = vi.mocked(apiPostRemotePublic).mock.calls[0];
    expect(payload).toMatchObject({
      deviceType: 'TV_MONITOR',
      publicKeyAlgorithm: 'P256_SHA256',
      keyProof: { nonce: expect.any(String), signature: expect.any(String) },
    });
    expect(payload).not.toHaveProperty('privateKey');
    expect(pairing.claimUrl).toContain('/pair#v=1&pairingId=pairing-1&claimToken=');
    expect(pairing).not.toHaveProperty('claimToken');

    const identity = await readStoredTvMonitorIdentity();
    expect(identity?.device).toBeUndefined();
    expect(identity?.pairing).toEqual(pairing);
    expect(identity?.privateKey.extractable).toBe(false);
    await expect(crypto.subtle.exportKey('jwk', identity!.privateKey)).rejects.toThrow();
    expect(window.localStorage.length).toBe(0);
  });

  it('rejects a QR contract that leaks the claim secret through the query string', async () => {
    vi.mocked(apiPostRemotePublic).mockResolvedValueOnce(
      pairingResponse(
        'https://admin.cafe-postcode.uz/pair?claimToken=claim-token-with-enough-entropy-1234567#v=1&pairingId=pairing-1&claimToken=claim-token-with-enough-entropy-1234567',
      ),
    );

    await expect(kitchenRepository.createTvMonitorPairing()).rejects.toThrow('fragmentli QR');

    expect((await readStoredTvMonitorIdentity())?.pairing).toBeUndefined();
  });

  it('rejects a fragment-correct QR URL from an untrusted host', async () => {
    vi.mocked(apiPostRemotePublic).mockResolvedValueOnce(
      pairingResponse(
        'https://evil.example/pair#v=1&pairingId=pairing-1&claimToken=claim-token-with-enough-entropy-1234567',
      ),
    );

    await expect(kitchenRepository.createTvMonitorPairing()).rejects.toThrow('fragmentli QR');
    expect((await readStoredTvMonitorIdentity())?.pairing).toBeUndefined();
  });

  it('silently migrates a legacy bearer once and immediately erases it from browser and Android storage', async () => {
    const legacy = {
      token: 'legacy-tv-token-with-sufficient-entropy',
      restaurantId: restaurantContext.restaurantId,
      restaurantName: restaurantContext.restaurantName,
    };
    let nativeValue: string | null = JSON.stringify(legacy);
    const clearDevice = vi.fn(() => {
      nativeValue = null;
    });
    const setDevice = vi.fn((value: string) => {
      nativeValue = value;
    });
    window.localStorage.setItem('restaurant-pos-tv-monitor-device', JSON.stringify(legacy));
    window.CafePostcodeTv = { getDevice: () => nativeValue || '', clearDevice, setDevice };
    vi.mocked(apiPostRemotePublic).mockResolvedValueOnce({ device: activeDevice, restaurantContext });

    const result = await kitchenRepository.bootstrapTvMonitor();

    expect(result).toEqual({
      status: 'paired',
      device: {
        deviceId: activeDevice.id,
        deviceStatus: 'ACTIVE',
        leaseExpiresAt: activeDevice.leaseExpiresAt,
        ...restaurantContext,
      },
    });
    expect(apiPostRemotePublic).toHaveBeenCalledWith(
      '/devices/legacy-tv-migration/',
      expect.objectContaining({
        publicKeyAlgorithm: 'P256_SHA256',
        publicKey: expect.any(String),
        keyProof: { nonce: expect.any(String), signature: expect.any(String) },
      }),
      { headers: { 'X-TV-Token': legacy.token } },
    );
    expect(readLegacyTvMonitorCredential()).toBeNull();
    expect(readTvMonitorDevice()?.deviceId).toBe(activeDevice.id);
    expect(window.localStorage.getItem('restaurant-pos-tv-monitor-device')).not.toContain(legacy.token);
    expect(clearDevice).toHaveBeenCalled();
    expect(setDevice.mock.calls[setDevice.mock.calls.length - 1]?.[0]).not.toContain('token');
    expect((await readStoredTvMonitorIdentity())?.device).toEqual(activeDevice);
  });

  it('preserves a legacy bearer on a transient migration failure so silent migration can retry', async () => {
    const legacy = { token: 'legacy-tv-token-with-sufficient-entropy' };
    window.localStorage.setItem('restaurant-pos-tv-monitor-device', JSON.stringify(legacy));
    vi.mocked(apiPostRemotePublic).mockRejectedValueOnce(new Error('offline'));

    await expect(kitchenRepository.bootstrapTvMonitor()).rejects.toThrow('offline');

    expect(readLegacyTvMonitorCredential()).toEqual(legacy);
  });

  it('retires an invalid legacy bearer and falls back to a fresh admin-approved pairing', async () => {
    const legacy = { token: 'retired-legacy-tv-token' };
    window.localStorage.setItem('restaurant-pos-tv-monitor-device', JSON.stringify(legacy));
    vi.mocked(apiPostRemotePublic).mockRejectedValueOnce(
      Object.assign(new Error('retired'), {
        isAxiosError: true,
        response: { status: 401, data: { code: 'legacy_tv_credential_invalid' } },
      }),
    );

    await expect(kitchenRepository.bootstrapTvMonitor()).resolves.toEqual({ status: 'unpaired' });

    expect(readLegacyTvMonitorCredential()).toBeNull();
    expect(await readStoredTvMonitorIdentity()).not.toBeNull();
  });

  it('renews an expiring lease with device proof before restoring TV metadata', async () => {
    const expiredDevice = { ...activeDevice, leaseExpiresAt: '2020-01-01T00:00:00.000Z' };
    const renewedDevice = { ...activeDevice, leaseExpiresAt: '2099-01-02T00:00:00.000Z' };
    vi.mocked(apiPostRemotePublic)
      .mockResolvedValueOnce(pairingResponse())
      .mockResolvedValueOnce({ status: 'paired', device: expiredDevice, restaurantContext })
      .mockResolvedValueOnce({ device: renewedDevice, leaseExpiresAt: renewedDevice.leaseExpiresAt });
    vi.mocked(apiGetRemotePublic).mockResolvedValueOnce({ device: renewedDevice, restaurantContext });
    const pairing = await kitchenRepository.createTvMonitorPairing();
    await kitchenRepository.getTvMonitorPairingStatus(pairing.id, pairing.pollToken);

    await expect(kitchenRepository.bootstrapTvMonitor()).resolves.toMatchObject({
      status: 'paired',
      device: { deviceId: renewedDevice.id, leaseExpiresAt: renewedDevice.leaseExpiresAt },
    });

    const [renewUrl, renewBody, renewConfig] = vi.mocked(apiPostRemotePublic).mock.calls[2];
    expect(renewUrl).toBe('/devices/lease/renew/');
    expect(renewBody).toBe('{}');
    expect(renewConfig?.headers).toMatchObject({
      'X-Device-Id': renewedDevice.id,
      'X-Device-Signature': expect.any(String),
    });
    expect(renewConfig?.headers).not.toHaveProperty('X-TV-Token');
    expect(apiGetRemotePublic).toHaveBeenCalledWith(
      '/devices/me/',
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-Device-Id': renewedDevice.id }),
      }),
    );
  });

  it('signs every queue and diagnostics request with the paired TV key and never sends X-TV-Token', async () => {
    vi.mocked(apiPostRemotePublic)
      .mockResolvedValueOnce(pairingResponse())
      .mockResolvedValueOnce({ status: 'paired', device: activeDevice, restaurantContext })
      .mockResolvedValueOnce(undefined);
    vi.mocked(apiGetRemotePublic).mockResolvedValueOnce({
      monitorVariant: 'light_compact',
      preparing: [],
      recentlyDone: [],
      announcements: [],
    });
    const pairing = await kitchenRepository.createTvMonitorPairing();
    await kitchenRepository.getTvMonitorPairingStatus(pairing.id, pairing.pollToken);

    await kitchenRepository.getTvMonitorQueue();
    const diagnostic = { event: 'page_loaded' as const, clientTime: '2026-08-16T12:00:00.000Z' };
    await kitchenRepository.reportTvMonitorDiagnostic(diagnostic);

    const [, queueConfig] = vi.mocked(apiGetRemotePublic).mock.calls[0];
    const queueHeaders = queueConfig?.headers as Record<string, string>;
    expect(queueHeaders).toMatchObject({
      'X-Device-Id': activeDevice.id,
      'X-Device-Timestamp': expect.any(String),
      'X-Device-Nonce': expect.any(String),
      'X-Device-Content-SHA256': await sha256Hex(new Uint8Array()),
      'X-Device-Signature': expect.any(String),
    });
    expect(queueHeaders).not.toHaveProperty('X-TV-Token');

    const [diagnosticUrl, diagnosticWireBody, diagnosticConfig] = vi.mocked(apiPostRemotePublic).mock.calls[2];
    const diagnosticHeaders = diagnosticConfig?.headers as Record<string, string>;
    expect(diagnosticUrl).toBe('/pos/monitor/tv-diagnostics/');
    expect(diagnosticWireBody).toBe(JSON.stringify(diagnostic));
    expect(diagnosticHeaders['X-Device-Content-SHA256']).toBe(await sha256Hex(JSON.stringify(diagnostic)));
    expect(diagnosticHeaders['X-Device-Nonce']).not.toBe(queueHeaders['X-Device-Nonce']);
    expect(diagnosticHeaders).not.toHaveProperty('X-TV-Token');

    const identity = await readStoredTvMonitorIdentity();
    const publicKey = await crypto.subtle.importKey(
      'spki',
      base64UrlToBytes(identity!.publicKey),
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    );
    const canonical = [
      'v1',
      'POST',
      '/api/v1/pos/monitor/tv-diagnostics/',
      activeDevice.id,
      diagnosticHeaders['X-Device-Timestamp'],
      diagnosticHeaders['X-Device-Nonce'],
      diagnosticHeaders['X-Device-Content-SHA256'],
    ].join('\n');
    expect(
      await crypto.subtle.verify(
        { name: 'ECDSA', hash: 'SHA-256' },
        publicKey,
        base64UrlToBytes(diagnosticHeaders['X-Device-Signature']),
        new TextEncoder().encode(canonical),
      ),
    ).toBe(true);
  });
});
