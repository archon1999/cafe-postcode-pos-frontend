// @vitest-environment jsdom

import { webcrypto } from 'node:crypto';

import 'fake-indexeddb/auto';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import {
  clearStoredDeviceIdentity,
  persistDeviceIdentity,
  readStoredDeviceIdentity,
  resetDeviceIdentityDatabaseForTests,
} from './device-identity.store';
import {
  base64UrlToBytes,
  createDeviceProofHeaders,
  createPairingKeyProof,
  createPairingStatusProof,
  createPosDeviceIdentity,
  sha256Hex,
} from './device-proof';

beforeAll(() => {
  Object.defineProperty(window, 'crypto', { configurable: true, value: webcrypto });
});

afterEach(async () => {
  await clearStoredDeviceIdentity().catch(() => undefined);
  resetDeviceIdentityDatabaseForTests();
  localStorage.clear();
});

async function verify(
  identity: Awaited<ReturnType<typeof createPosDeviceIdentity>>,
  canonical: string,
  signature: string,
) {
  const publicKey = await crypto.subtle.importKey(
    'spki',
    base64UrlToBytes(identity.publicKey),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify'],
  );
  return crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    publicKey,
    base64UrlToBytes(signature),
    new TextEncoder().encode(canonical),
  );
}

describe('POS device cryptographic identity', () => {
  it('creates a non-exportable private P-256 key and persists only its CryptoKey handle in IndexedDB', async () => {
    const identity = await createPosDeviceIdentity();

    expect(identity.privateKey.algorithm).toMatchObject({ name: 'ECDSA', namedCurve: 'P-256' });
    expect(identity.privateKey.extractable).toBe(false);
    await expect(crypto.subtle.exportKey('jwk', identity.privateKey)).rejects.toThrow();
    expect(identity.publicKeyFingerprint).toBe(await sha256Hex(base64UrlToBytes(identity.publicKey)));

    await persistDeviceIdentity(identity);
    const restored = await readStoredDeviceIdentity();

    expect(restored?.privateKey).toBeInstanceOf(CryptoKey);
    expect(restored?.privateKey.extractable).toBe(false);
    expect(localStorage.length).toBe(0);
  });

  it('proves possession during pairing without transmitting the private key', async () => {
    const identity = await createPosDeviceIdentity();
    const proof = await createPairingKeyProof(identity);
    const canonical = `pairing-v1\n${proof.nonce}\n${identity.publicKeyFingerprint}`;

    expect(base64UrlToBytes(proof.nonce)).toHaveLength(32);
    expect(base64UrlToBytes(proof.signature)).toHaveLength(64);
    expect(await verify(identity, canonical, proof.signature)).toBe(true);
  });

  it('binds pairing status polling to its poll-token hash and device key', async () => {
    const identity = await createPosDeviceIdentity();
    const proof = await createPairingStatusProof(identity, 'pairing-id', 'secret-poll-token');
    const canonical = `pairing-status-v1\npairing-id\n${proof.timestamp}\n${proof.nonce}\n${await sha256Hex('secret-poll-token')}`;

    expect(await verify(identity, canonical, proof.signature)).toBe(true);
    expect(canonical).not.toContain('secret-poll-token');
  });

  it('signs the exact method, request target and serialized request body for remote POS calls', async () => {
    const identity = await createPosDeviceIdentity();
    const activeIdentity = await persistDeviceIdentity({
      ...identity,
      device: {
        id: 'A1111111-1111-4111-8111-111111111111',
        type: 'POS_TERMINAL',
        name: 'Cashbox',
        status: 'ACTIVE',
        leaseExpiresAt: '2026-08-17T12:00:00.000Z',
      },
      restaurantContext: { restaurantId: 'restaurant-1', restaurantName: 'Cafe' },
    });

    const proof = await createDeviceProofHeaders(
      {
        baseURL: 'https://api.cafe-postcode.uz/api/v1',
        url: '/pos/sales/orders/?status=open',
        method: 'post',
        data: { amount: 12500, note: 'test' },
      },
      activeIdentity,
    );

    expect(proof).not.toBeNull();
    const headers = proof!.headers;
    expect(proof!.wireData).toBe('{"amount":12500,"note":"test"}');
    expect(headers['X-Device-Id']).toBe('a1111111-1111-4111-8111-111111111111');
    expect(headers['X-Device-Content-SHA256']).toBe(await sha256Hex(proof!.wireData as string));
    const canonical = [
      'v1',
      'POST',
      '/api/v1/pos/sales/orders/?status=open',
      headers['X-Device-Id'],
      headers['X-Device-Timestamp'],
      headers['X-Device-Nonce'],
      headers['X-Device-Content-SHA256'],
    ].join('\n');
    expect(await verify(identity, canonical, headers['X-Device-Signature'])).toBe(true);
  });
});
