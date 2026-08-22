// @vitest-environment jsdom

import { webcrypto } from 'node:crypto';

import { AxiosHeaders, type AxiosRequestConfig, type AxiosResponse, type RawAxiosHeaders } from 'axios';
import 'fake-indexeddb/auto';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  base64UrlToBytes,
  bytesToBase64Url,
  clearStoredDeviceIdentity,
  createDeviceProofHeaders,
  createPosDeviceIdentity,
  persistDeviceIdentity,
  readStoredDeviceIdentity,
  resetDeviceIdentityDatabaseForTests,
  sha256Hex,
} from 'modules/auth/data-access/device';

import {
  LEGACY_EDGE_MIGRATION_CREDENTIAL_STORAGE_KEY,
  EDGE_TERMINAL_ID_STORAGE_KEY,
  persistLegacyEdgeMigrationCredential,
  readLegacyEdgeMigrationCredential,
  readTransportConnection,
} from './edgeConnection';
import {
  ensureLocalAgentSecureChannel,
  protectLocalAxiosRequest,
  secureLocalJSONRequest,
  unprotectLocalAxiosResponse,
} from './edgeSecureChannel';

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const origin = 'http://192.168.1.30:18181';
const terminalId = 'pos-terminal-browser-test';
const legacyToken = `ept_${'a'.repeat(43)}`;

beforeAll(() => {
  Object.defineProperty(window, 'crypto', { configurable: true, value: webcrypto });
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await clearStoredDeviceIdentity().catch(() => undefined);
  resetDeviceIdentityDatabaseForTests();
  localStorage.clear();
});

function hmacKey(keyBytes: Uint8Array, usages: KeyUsage[]) {
  return crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, usages);
}

async function hmac(keyBytes: Uint8Array, value: string) {
  const key = await hmacKey(keyBytes, ['sign']);
  return bytesToBase64Url(await crypto.subtle.sign('HMAC', key, encoder.encode(value)));
}

async function aesKey(material: Uint8Array) {
  return crypto.subtle.importKey('raw', material.slice(0, 32), 'AES-GCM', false, ['encrypt', 'decrypt']);
}

describe('Local Agent application-layer secure channel', () => {
  it('never sends the legacy bearer or PIN and authenticates encrypted session responses', async () => {
    const identity = await createPosDeviceIdentity();
    await persistDeviceIdentity(identity);
    localStorage.setItem(EDGE_TERMINAL_ID_STORAGE_KEY, terminalId);
    persistLegacyEdgeMigrationCredential(origin, legacyToken, 'restaurant-1');

    const agentKeys = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
    const agentPublicKey = bytesToBase64Url(await crypto.subtle.exportKey('raw', agentKeys.publicKey));
    const agentPublicKeyFingerprint = Array.from(
      new Uint8Array(await crypto.subtle.digest('SHA-256', base64UrlToBytes(agentPublicKey))),
      (value) => value.toString(16).padStart(2, '0'),
    ).join('');
    let derivedMaterial: Uint8Array | null = null;
    let handshakeWireBody = '';

    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        handshakeWireBody = String(init?.body || '');
        expect(handshakeWireBody).not.toContain(legacyToken);
        expect(new Headers(init?.headers).get('X-Edge-Token')).toBeNull();
        const input = JSON.parse(handshakeWireBody) as {
          terminalId: string;
          clientPublicKey: string;
          timestamp: string;
          nonce: string;
          authenticationMode: string;
          authenticationProof: string;
        };
        expect(input.authenticationMode).toBe('LEGACY_PSK');
        const tokenHash = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(legacyToken)));
        const canonical = [
          'edge-channel-init-v1',
          input.terminalId,
          input.clientPublicKey,
          input.timestamp,
          input.nonce,
        ].join('\n');
        expect(input.authenticationProof).toBe(await hmac(tokenHash, canonical));

        const clientKey = await crypto.subtle.importKey(
          'raw',
          base64UrlToBytes(input.clientPublicKey),
          { name: 'ECDH', namedCurve: 'P-256' },
          false,
          [],
        );
        const shared = await crypto.subtle.deriveBits({ name: 'ECDH', public: clientKey }, agentKeys.privateKey, 256);
        const hkdfKey = await crypto.subtle.importKey('raw', shared, 'HKDF', false, ['deriveBits']);
        const serverNonce = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
        const transcript = [
          'edge-channel-v1',
          'restaurant-1',
          input.terminalId,
          input.clientPublicKey,
          agentPublicKey,
          input.timestamp,
          input.nonce,
          serverNonce,
        ].join('\n');
        derivedMaterial = new Uint8Array(
          await crypto.subtle.deriveBits(
            { name: 'HKDF', hash: 'SHA-256', salt: tokenHash, info: encoder.encode(transcript) },
            hkdfKey,
            512,
          ),
        );
        const expiresAt = new Date(Date.now() + 30 * 60_000).toISOString();
        const channelId = 'channel-browser-test';
        const confirmation = await hmac(
          derivedMaterial.slice(32),
          `edge-channel-confirm-v1\n${transcript}\n${channelId}\n${expiresAt}`,
        );
        return new Response(
          JSON.stringify({
            version: 'v1',
            channelId,
            terminalId,
            agentPublicKeyAlgorithm: 'P256_ECDH',
            agentPublicKey,
            agentPublicKeyFingerprint,
            serverNonce,
            expiresAt,
            confirmation,
            restaurantId: 'restaurant-1',
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } },
        );
      }),
    );

    const firstRequestConfigs: AxiosRequestConfig[] = Array.from({ length: 24 }, (_, index) => ({
      baseURL: `${origin}/v1`,
      url: '/pos/auth/pin-login/',
      method: 'POST',
      data: { restaurantId: 'restaurant-1', pin: '1234' },
      headers: {
        Authorization: 'Token prior-session',
        'Content-Type': 'application/json',
        'X-Edge-Operation-ID': `operation-${index + 1}`,
      },
    }));
    await Promise.all(firstRequestConfigs.map((config) => protectLocalAxiosRequest(config)));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(
      new Set(
        firstRequestConfigs.map((config) =>
          String(AxiosHeaders.from(config.headers as RawAxiosHeaders).get('X-Edge-Channel-Id')),
        ),
      ).size,
    ).toBe(1);
    expect(handshakeWireBody).not.toContain(legacyToken);
    expect(readLegacyEdgeMigrationCredential()).toBe('');
    expect(localStorage.getItem(LEGACY_EDGE_MIGRATION_CREDENTIAL_STORAGE_KEY)).toBeNull();
    expect(readTransportConnection()).toMatchObject({ secureChannel: true });
    expect(readTransportConnection()).not.toHaveProperty('token');
    const stored = await readStoredDeviceIdentity();
    expect(stored?.localSecureChannel?.clientPrivateKey.extractable).toBe(false);
    expect(stored?.localSecureChannel?.sessionKey?.extractable).toBe(false);

    const config = firstRequestConfigs[0];
    const wireRequest = String(config.data);
    expect(wireRequest).not.toContain('1234');
    expect(wireRequest).not.toContain('restaurant-1');
    expect(AxiosHeaders.from(config.headers as RawAxiosHeaders).get('Authorization')).toBeUndefined();
    expect(AxiosHeaders.from(config.headers as RawAxiosHeaders).get('X-Edge-Token')).toBeUndefined();

    const requestHeaders = AxiosHeaders.from(config.headers as RawAxiosHeaders);
    const requestNonce = String(requestHeaders.get('X-Edge-Channel-Nonce'));
    const envelope = JSON.parse(wireRequest) as { ciphertext: string };
    const sessionKey = await aesKey(derivedMaterial!);
    const requestPlaintext = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: base64UrlToBytes(requestNonce),
        additionalData: encoder.encode(
          [
            'edge-channel-v1',
            'request',
            'POST',
            '/v1/pos/auth/pin-login/',
            terminalId,
            'channel-browser-test',
            requestNonce,
          ].join('\n'),
        ),
      },
      sessionKey,
      base64UrlToBytes(envelope.ciphertext),
    );
    const inner = JSON.parse(decoder.decode(requestPlaintext)) as { body: string; authorization: string };
    expect(JSON.parse(decoder.decode(base64UrlToBytes(inner.body)))).toEqual({
      restaurantId: 'restaurant-1',
      pin: '1234',
    });
    expect(inner.authorization).toBe('Token prior-session');

    const proof = await createDeviceProofHeaders(config, undefined, terminalId);
    expect(proof).not.toBeNull();
    config.data = proof!.wireData;
    for (const [name, value] of Object.entries(proof!.headers)) requestHeaders.set(name, value);
    config.headers = requestHeaders;

    const responseNonceBytes = crypto.getRandomValues(new Uint8Array(12));
    const responseNonce = bytesToBase64Url(responseNonceBytes);
    const responsePlaintext = JSON.stringify({ token: 'encrypted-session-token', user: { id: 'user-1' } });
    const responseAAD = [
      'edge-channel-v1',
      'response',
      'POST',
      '/v1/pos/auth/pin-login/',
      terminalId,
      'channel-browser-test',
      proof!.headers['X-Device-Nonce'],
      responseNonce,
      '200',
    ].join('\n');
    const responseCiphertext = bytesToBase64Url(
      await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: responseNonceBytes, additionalData: encoder.encode(responseAAD) },
        sessionKey,
        encoder.encode(responsePlaintext),
      ),
    );
    const outerResponse = JSON.stringify({ ciphertext: responseCiphertext });
    expect(outerResponse).not.toContain('encrypted-session-token');
    const response = {
      data: JSON.parse(outerResponse),
      status: 200,
      statusText: 'OK',
      headers: { 'x-edge-channel-nonce': responseNonce },
      config,
    } as AxiosResponse<{ token: string; user: { id: string } }>;

    await expect(unprotectLocalAxiosResponse(response)).resolves.toMatchObject({
      data: { token: 'encrypted-session-token', user: { id: 'user-1' } },
    });

    await expect(
      unprotectLocalAxiosResponse({
        data: { token: 'forged-plaintext-token' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      } as AxiosResponse<{ token: string }>),
    ).rejects.toThrow('was not encrypted');
    await expect(
      unprotectLocalAxiosResponse({
        data: { code: 'session_locked' },
        status: 401,
        statusText: 'Unauthorized',
        headers: {},
        config,
      } as AxiosResponse<{ code: string }>),
    ).rejects.toThrow('was not encrypted');
    await expect(
      unprotectLocalAxiosResponse({
        data: { ciphertext: 'AAAA' },
        status: 200,
        statusText: 'OK',
        headers: { 'x-edge-channel-nonce': 'AAAA' },
        config,
      } as AxiosResponse<{ ciphertext: string }>),
    ).rejects.toThrow('nonce is invalid');
    await expect(
      unprotectLocalAxiosResponse({
        data: {},
        status: 200,
        statusText: 'OK',
        headers: { 'x-edge-channel-nonce': responseNonce },
        config,
      } as AxiosResponse<Record<string, never>>),
    ).rejects.toThrow('malformed');
    await expect(
      unprotectLocalAxiosResponse({
        data: { ok: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: { baseURL: 'https://api.example.test', url: '/public/status', method: 'GET', headers: {} },
      } as AxiosResponse<{ ok: boolean }>),
    ).resolves.toMatchObject({ data: { ok: true } });
  });

  it('binds the outer device-proof nonce into secure JSON response AAD and rejects tampering', async () => {
    expect(typeof Reflect.get(AxiosHeaders.from({}), 'entries')).toBe('undefined');
    const identity = await createPosDeviceIdentity();
    await persistDeviceIdentity(identity);
    localStorage.setItem(EDGE_TERMINAL_ID_STORAGE_KEY, terminalId);
    persistLegacyEdgeMigrationCredential(origin, legacyToken, 'restaurant-1');

    const agentKeys = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
    const agentPublicKey = bytesToBase64Url(await crypto.subtle.exportKey('raw', agentKeys.publicKey));
    const agentPublicKeyFingerprint = await sha256Hex(base64UrlToBytes(agentPublicKey));
    const channelId = 'channel-secure-json-test';
    let sessionKey: CryptoKey | null = null;
    let fetchCall = 0;

    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        fetchCall += 1;
        if (fetchCall === 1) {
          const input = JSON.parse(String(init?.body)) as {
            terminalId: string;
            clientPublicKey: string;
            timestamp: string;
            nonce: string;
          };
          const tokenHash = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(legacyToken)));
          const clientKey = await crypto.subtle.importKey(
            'raw',
            base64UrlToBytes(input.clientPublicKey),
            { name: 'ECDH', namedCurve: 'P-256' },
            false,
            [],
          );
          const shared = await crypto.subtle.deriveBits({ name: 'ECDH', public: clientKey }, agentKeys.privateKey, 256);
          const hkdfKey = await crypto.subtle.importKey('raw', shared, 'HKDF', false, ['deriveBits']);
          const serverNonce = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
          const transcript = [
            'edge-channel-v1',
            'restaurant-1',
            input.terminalId,
            input.clientPublicKey,
            agentPublicKey,
            input.timestamp,
            input.nonce,
            serverNonce,
          ].join('\n');
          const material = new Uint8Array(
            await crypto.subtle.deriveBits(
              { name: 'HKDF', hash: 'SHA-256', salt: tokenHash, info: encoder.encode(transcript) },
              hkdfKey,
              512,
            ),
          );
          sessionKey = await aesKey(material);
          const expiresAt = new Date(Date.now() + 30 * 60_000).toISOString();
          const confirmation = await hmac(
            material.slice(32),
            `edge-channel-confirm-v1\n${transcript}\n${channelId}\n${expiresAt}`,
          );
          material.fill(0);
          return new Response(
            JSON.stringify({
              version: 'v1',
              channelId,
              terminalId,
              agentPublicKeyAlgorithm: 'P256_ECDH',
              agentPublicKey,
              agentPublicKeyFingerprint,
              serverNonce,
              expiresAt,
              confirmation,
              restaurantId: 'restaurant-1',
            }),
            { status: 201, headers: { 'Content-Type': 'application/json' } },
          );
        }

        if (!sessionKey) throw new Error('secure-channel session key was not derived');
        const headers = new Headers(init?.headers);
        const deviceNonce = headers.get('X-Device-Nonce');
        expect(deviceNonce).toBeTruthy();
        expect(headers.get('X-Edge-Channel-Id')).toBe(channelId);
        const responseNonceBytes = crypto.getRandomValues(new Uint8Array(12));
        const responseNonce = bytesToBase64Url(responseNonceBytes);
        const responseAAD = [
          'edge-channel-v1',
          'response',
          'POST',
          '/v1/pos/devices/migration-attestation',
          terminalId,
          channelId,
          fetchCall === 3 ? `${deviceNonce}-tampered` : deviceNonce,
          responseNonce,
          '201',
        ].join('\n');
        const ciphertext = bytesToBase64Url(
          await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: responseNonceBytes, additionalData: encoder.encode(responseAAD) },
            sessionKey,
            encoder.encode(JSON.stringify({ ok: true, restaurantId: 'restaurant-1' })),
          ),
        );
        return new Response(JSON.stringify({ ciphertext }), {
          status: 201,
          headers: { 'Content-Type': 'application/json', 'X-Edge-Channel-Nonce': responseNonce },
        });
      }),
    );

    await expect(
      secureLocalJSONRequest(
        origin,
        '/v1/pos/devices/migration-attestation',
        { terminalId, publicKey: identity.publicKey },
        legacyToken,
      ),
    ).resolves.toMatchObject({ ok: true, status: 201, data: { ok: true, restaurantId: 'restaurant-1' } });
    await expect(
      secureLocalJSONRequest(origin, '/v1/pos/devices/migration-attestation', { terminalId }),
    ).rejects.toThrow();
    expect(fetchCall).toBe(3);
  });

  it('opens a fresh tokenless channel only after verifying the backend-trusted Agent attestation', async () => {
    const identity = await createPosDeviceIdentity();
    const deviceId = '11111111-1111-4111-8111-111111111111';
    await persistDeviceIdentity({
      ...identity,
      device: {
        id: deviceId,
        type: 'POS_TERMINAL',
        name: 'Fresh POS',
        status: 'ACTIVE',
        leaseExpiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
      restaurantContext: { restaurantId: 'restaurant-1', restaurantName: 'Cafe' },
    });
    localStorage.setItem(EDGE_TERMINAL_ID_STORAGE_KEY, terminalId);

    const agentECDH = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
    const agentECDHPublic = bytesToBase64Url(await crypto.subtle.exportKey('raw', agentECDH.publicKey));
    const agentECDHFingerprint = await sha256Hex(base64UrlToBytes(agentECDHPublic));
    const agentSigning = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
    const agentSigningPublic = bytesToBase64Url(await crypto.subtle.exportKey('raw', agentSigning.publicKey));
    const agentSigningFingerprint = await sha256Hex(base64UrlToBytes(agentSigningPublic));
    const agentDeviceId = '22222222-2222-4222-8222-222222222222';
    const staleClientECDH = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, [
      'deriveBits',
    ]);
    const staleAgentECDH = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, [
      'deriveBits',
    ]);
    const staleAgentPublic = bytesToBase64Url(await crypto.subtle.exportKey('raw', staleAgentECDH.publicKey));
    const staleIdentity = await readStoredDeviceIdentity();
    if (!staleIdentity) throw new Error('POS identity was not persisted');
    await persistDeviceIdentity({
      ...staleIdentity,
      localSecureChannel: {
        version: 1,
        clientPrivateKey: staleClientECDH.privateKey,
        clientPublicKey: bytesToBase64Url(await crypto.subtle.exportKey('raw', staleClientECDH.publicKey)),
        terminalId,
        origin,
        agentPublicKey: staleAgentPublic,
        agentPublicKeyFingerprint: await sha256Hex(base64UrlToBytes(staleAgentPublic)),
        sessionKey: await crypto.subtle.importKey('raw', crypto.getRandomValues(new Uint8Array(32)), 'AES-GCM', false, [
          'encrypt',
          'decrypt',
        ]),
        channelId: 'stale-channel',
        expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
      },
    });
    let tamperAttestation = false;

    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const input = JSON.parse(String(init?.body)) as {
          terminalId: string;
          clientPublicKey: string;
          timestamp: string;
          nonce: string;
          authenticationMode: string;
          authenticationProof: string;
          deviceBinding?: unknown;
        };
        expect(input.authenticationMode).toBe('DEVICE_PROOF');
        expect(input.deviceBinding).toBeUndefined();
        expect(String(init?.body)).not.toContain('ept_');
        const initCanonical = [
          'edge-channel-init-v1',
          input.terminalId,
          input.clientPublicKey,
          input.timestamp,
          input.nonce,
        ].join('\n');
        const posPublicKey = await crypto.subtle.importKey(
          'spki',
          base64UrlToBytes(identity.publicKey),
          { name: 'ECDSA', namedCurve: 'P-256' },
          false,
          ['verify'],
        );
        expect(
          await crypto.subtle.verify(
            { name: 'ECDSA', hash: 'SHA-256' },
            posPublicKey,
            base64UrlToBytes(input.authenticationProof),
            encoder.encode(initCanonical),
          ),
        ).toBe(true);

        const clientECDH = await crypto.subtle.importKey(
          'raw',
          base64UrlToBytes(input.clientPublicKey),
          { name: 'ECDH', namedCurve: 'P-256' },
          false,
          [],
        );
        const shared = await crypto.subtle.deriveBits({ name: 'ECDH', public: clientECDH }, agentECDH.privateKey, 256);
        const hkdfKey = await crypto.subtle.importKey('raw', shared, 'HKDF', false, ['deriveBits']);
        const serverNonce = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
        const transcript = [
          'edge-channel-v1',
          'restaurant-1',
          input.terminalId,
          input.clientPublicKey,
          agentECDHPublic,
          input.timestamp,
          input.nonce,
          serverNonce,
        ].join('\n');
        const material = new Uint8Array(
          await crypto.subtle.deriveBits(
            {
              name: 'HKDF',
              hash: 'SHA-256',
              salt: Uint8Array.from(identity.publicKeyFingerprint.match(/.{2}/g) || [], (value) =>
                Number.parseInt(value, 16),
              ),
              info: encoder.encode(transcript),
            },
            hkdfKey,
            512,
          ),
        );
        const channelId = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(24)));
        const expiresAt = new Date(Date.now() + 30 * 60_000).toISOString();
        const confirmation = await hmac(
          material.slice(32),
          `edge-channel-confirm-v1\n${transcript}\n${channelId}\n${expiresAt}`,
        );
        material.fill(0);
        const attestationCanonical = [
          'edge-channel-attestation-v1',
          agentDeviceId,
          'restaurant-1',
          agentECDHFingerprint,
          channelId,
          expiresAt,
        ].join('\n');
        let agentAttestation = bytesToBase64Url(
          await crypto.subtle.sign('Ed25519', agentSigning.privateKey, encoder.encode(attestationCanonical)),
        );
        if (tamperAttestation) {
          agentAttestation = `${agentAttestation.startsWith('A') ? 'B' : 'A'}${agentAttestation.slice(1)}`;
        }
        return new Response(
          JSON.stringify({
            version: 'v1',
            channelId,
            terminalId,
            agentPublicKeyAlgorithm: 'P256_ECDH',
            agentPublicKey: agentECDHPublic,
            agentPublicKeyFingerprint: agentECDHFingerprint,
            serverNonce,
            expiresAt,
            confirmation,
            agentDeviceId,
            restaurantId: 'restaurant-1',
            agentSigningPublicKeyAlgorithm: 'ED25519',
            agentSigningPublicKey: agentSigningPublic,
            agentAttestation,
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } },
        );
      }),
    );

    const trust = {
      restaurantId: 'restaurant-1',
      agentDeviceId,
      agentSigningPublicKeyAlgorithm: 'ED25519' as const,
      agentSigningPublicKey: agentSigningPublic,
      agentSigningPublicKeyFingerprint: agentSigningFingerprint,
    };
    await expect(ensureLocalAgentSecureChannel(origin, '', true, trust)).resolves.toBe(true);
    expect(readLegacyEdgeMigrationCredential()).toBe('');
    expect((await readStoredDeviceIdentity())?.localSecureChannel?.agentPublicKey).toBe(agentECDHPublic);
    expect(agentECDHPublic).not.toBe(staleAgentPublic);

    tamperAttestation = true;
    await expect(ensureLocalAgentSecureChannel(origin, '', true, trust)).resolves.toBe(false);
  });

  it('reopens a stale channel after an Agent restart using the pinned Agent transport key', async () => {
    const identity = await createPosDeviceIdentity();
    const agentECDH = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
    const agentPublicKey = bytesToBase64Url(await crypto.subtle.exportKey('raw', agentECDH.publicKey));
    const agentPublicKeyFingerprint = await sha256Hex(base64UrlToBytes(agentPublicKey));
    const clientECDH = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
    const clientPublicKey = bytesToBase64Url(await crypto.subtle.exportKey('raw', clientECDH.publicKey));
    const staleSessionKey = await crypto.subtle.importKey(
      'raw',
      crypto.getRandomValues(new Uint8Array(32)),
      'AES-GCM',
      false,
      ['encrypt', 'decrypt'],
    );
    await persistDeviceIdentity({
      ...identity,
      device: {
        id: '11111111-1111-4111-8111-111111111111',
        type: 'POS_TERMINAL',
        name: 'Restart recovery POS',
        status: 'ACTIVE',
        leaseExpiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
      restaurantContext: { restaurantId: 'restaurant-1', restaurantName: 'Cafe' },
      localSecureChannel: {
        version: 1,
        clientPrivateKey: clientECDH.privateKey,
        clientPublicKey,
        terminalId,
        origin,
        agentPublicKey,
        agentPublicKeyFingerprint,
        sessionKey: staleSessionKey,
        channelId: 'channel-lost-during-agent-restart',
        expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
      },
    });
    localStorage.setItem(EDGE_TERMINAL_ID_STORAGE_KEY, terminalId);

    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const input = JSON.parse(String(init?.body)) as {
          terminalId: string;
          clientPublicKey: string;
          timestamp: string;
          nonce: string;
          authenticationMode: string;
          authenticationProof: string;
          deviceBinding?: unknown;
        };
        expect(input.authenticationMode).toBe('DEVICE_PROOF');
        expect(input.deviceBinding).toBeUndefined();
        expect(input.clientPublicKey).toBe(clientPublicKey);

        const clientPublic = await crypto.subtle.importKey(
          'raw',
          base64UrlToBytes(input.clientPublicKey),
          { name: 'ECDH', namedCurve: 'P-256' },
          false,
          [],
        );
        const shared = await crypto.subtle.deriveBits(
          { name: 'ECDH', public: clientPublic },
          agentECDH.privateKey,
          256,
        );
        const hkdfKey = await crypto.subtle.importKey('raw', shared, 'HKDF', false, ['deriveBits']);
        const serverNonce = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
        const transcript = [
          'edge-channel-v1',
          'restaurant-1',
          input.terminalId,
          input.clientPublicKey,
          agentPublicKey,
          input.timestamp,
          input.nonce,
          serverNonce,
        ].join('\n');
        const salt = Uint8Array.from(identity.publicKeyFingerprint.match(/.{2}/g) || [], (value) =>
          Number.parseInt(value, 16),
        );
        const material = new Uint8Array(
          await crypto.subtle.deriveBits(
            { name: 'HKDF', hash: 'SHA-256', salt, info: encoder.encode(transcript) },
            hkdfKey,
            512,
          ),
        );
        const channelId = 'channel-after-agent-restart';
        const expiresAt = new Date(Date.now() + 30 * 60_000).toISOString();
        const confirmation = await hmac(
          material.slice(32),
          `edge-channel-confirm-v1\n${transcript}\n${channelId}\n${expiresAt}`,
        );
        material.fill(0);
        return new Response(
          JSON.stringify({
            version: 'v1',
            channelId,
            terminalId,
            agentPublicKeyAlgorithm: 'P256_ECDH',
            agentPublicKey,
            agentPublicKeyFingerprint,
            serverNonce,
            expiresAt,
            confirmation,
            restaurantId: 'restaurant-1',
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } },
        );
      }),
    );

    await expect(ensureLocalAgentSecureChannel(origin, '', true)).resolves.toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect((await readStoredDeviceIdentity())?.localSecureChannel).toMatchObject({
      channelId: 'channel-after-agent-restart',
      agentPublicKey,
      clientPublicKey,
    });
  });

  it('rejects an oversized handshake response before parsing it', async () => {
    const identity = await createPosDeviceIdentity();
    await persistDeviceIdentity({
      ...identity,
      device: {
        id: '11111111-1111-4111-8111-111111111111',
        type: 'POS_TERMINAL',
        name: 'Fresh POS',
        status: 'ACTIVE',
        leaseExpiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
    });
    localStorage.setItem(EDGE_TERMINAL_ID_STORAGE_KEY, terminalId);
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response('{}', {
            status: 201,
            headers: { 'Content-Type': 'application/json', 'Content-Length': String(64 * 1024 + 1) },
          }),
      ),
    );

    await expect(
      ensureLocalAgentSecureChannel(origin, '', true, {
        restaurantId: 'restaurant-1',
        agentDeviceId: '22222222-2222-4222-8222-222222222222',
        agentSigningPublicKeyAlgorithm: 'ED25519',
        agentSigningPublicKey: 'A'.repeat(43),
        agentSigningPublicKeyFingerprint: 'a'.repeat(64),
      }),
    ).rejects.toThrow('exceeded');
  });
});
