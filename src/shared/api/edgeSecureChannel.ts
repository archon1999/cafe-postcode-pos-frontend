import { AxiosHeaders, type AxiosRequestConfig, type AxiosResponse, type RawAxiosHeaders } from 'axios';

import {
  bytesToBase64Url,
  createDeviceProofHeaders,
  createPairingKeyProof,
  randomNonce,
  requestBodyBytes,
  resolveRequestTarget,
  sha256Hex,
  signCanonical,
} from 'modules/auth/data-access/device';
import {
  readStoredDeviceIdentity,
  updateStoredDeviceIdentity,
  type StoredPosDeviceIdentity,
} from 'modules/auth/data-access/device/device-identity.store';

import {
  markEdgeConnectionSecure,
  normalizeEdgeOrigin,
  readLegacyEdgeMigrationCredential,
  readOrCreateEdgeTerminalIdentity,
  readTransportConnection,
} from './edgeConnection';

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const CHANNEL_RENEW_LEAD_MS = 60_000;
const HANDSHAKE_TIMEOUT_MS = 5_000;
const HANDSHAKE_MAX_RESPONSE_BYTES = 64 * 1024;
const SECURE_REQUEST_TIMEOUT_MS = 15_000;
const SECURE_REQUEST_MAX_RESPONSE_BYTES = 4 * 1024 * 1024;

type LocalSecureResponseBinding = {
  required: true;
  origin: string;
  terminalId: string;
  channelId: string;
  sessionKey: CryptoKey;
};

type LocalSecureAxiosConfig = AxiosRequestConfig & {
  _edgeSecureResponseBinding?: LocalSecureResponseBinding;
};

type LocalAgentHandshakeFlight = {
  contractKey: string;
  promise: Promise<boolean>;
};

const localAgentHandshakeFlights = new Map<string, LocalAgentHandshakeFlight>();

function normalizedAxiosHeaders(value: AxiosRequestConfig['headers']) {
  return AxiosHeaders.from(value as RawAxiosHeaders | AxiosHeaders | undefined);
}

export type LocalAgentTrust = {
  restaurantId: string;
  terminalId?: string;
  agentDeviceId: string;
  agentSigningPublicKeyAlgorithm: 'ED25519';
  agentSigningPublicKey: string;
  agentSigningPublicKeyFingerprint: string;
};

type SecureRequestPlaintext = {
  body: string;
  authorization: string;
  contentType: string;
  operationId: string;
  acceptLanguage: string;
  language: string;
};

type HandshakeResponse = {
  version: 'v1';
  channelId: string;
  terminalId: string;
  agentPublicKeyAlgorithm: 'P256_ECDH';
  agentPublicKey: string;
  agentPublicKeyFingerprint: string;
  serverNonce: string;
  expiresAt: string;
  confirmation: string;
  agentDeviceId?: string;
  restaurantId?: string;
  agentSigningPublicKeyAlgorithm?: 'ED25519';
  agentSigningPublicKey?: string;
  agentAttestation?: string;
};

function cryptoApi() {
  const value = globalThis.crypto;
  if (!value?.subtle || typeof value.getRandomValues !== 'function') {
    throw new Error('Secure Local Agent channel requires Web Crypto.');
  }
  return value;
}

function base64UrlToBytes(value: string) {
  const padded = value
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function hexToBytes(value: string) {
  if (!/^[0-9a-f]{64}$/i.test(value)) throw new Error('Invalid device fingerprint.');
  return Uint8Array.from(value.match(/.{2}/g) || [], (item) => Number.parseInt(item, 16));
}

async function hmacBase64Url(keyBytes: Uint8Array, value: string) {
  const key = await cryptoApi().subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return bytesToBase64Url(await cryptoApi().subtle.sign('HMAC', key, encoder.encode(value)));
}

async function verifyHmac(keyBytes: Uint8Array, value: string, signature: string) {
  const key = await cryptoApi().subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  return cryptoApi().subtle.verify('HMAC', key, base64UrlToBytes(signature), encoder.encode(value));
}

async function ensureClientECDH(identity: StoredPosDeviceIdentity) {
  const existing = identity.localSecureChannel;
  if (existing?.clientPrivateKey && existing.clientPublicKey) {
    return { identity, privateKey: existing.clientPrivateKey, publicKey: existing.clientPublicKey };
  }
  const keys = await cryptoApi().subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
  const publicKey = bytesToBase64Url(await cryptoApi().subtle.exportKey('raw', keys.publicKey));
  const next = await updateStoredDeviceIdentity((current) => {
    if (current.publicKeyFingerprint !== identity.publicKeyFingerprint) {
      throw new Error('POS device identity changed while opening the Local Agent channel.');
    }
    if (current.localSecureChannel?.clientPrivateKey && current.localSecureChannel.clientPublicKey) return current;
    return {
      ...current,
      localSecureChannel: {
        version: 1,
        clientPrivateKey: keys.privateKey,
        clientPublicKey: publicKey,
      },
    };
  });
  return {
    identity: next,
    privateKey: next.localSecureChannel!.clientPrivateKey,
    publicKey: next.localSecureChannel!.clientPublicKey,
  };
}

async function deriveChannelMaterial(
  clientPrivateKey: CryptoKey,
  agentPublicKeyValue: string,
  salt: Uint8Array,
  transcript: string,
) {
  const agentPublicKey = await cryptoApi().subtle.importKey(
    'raw',
    base64UrlToBytes(agentPublicKeyValue),
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  );
  const sharedSecret = new Uint8Array(
    await cryptoApi().subtle.deriveBits({ name: 'ECDH', public: agentPublicKey }, clientPrivateKey, 256),
  );
  try {
    const hkdfKey = await cryptoApi().subtle.importKey('raw', sharedSecret, 'HKDF', false, ['deriveBits']);
    return new Uint8Array(
      await cryptoApi().subtle.deriveBits(
        { name: 'HKDF', hash: 'SHA-256', salt, info: encoder.encode(transcript) },
        hkdfKey,
        512,
      ),
    );
  } finally {
    sharedSecret.fill(0);
  }
}

export async function readBoundedJSONResponse<T>(response: Response, maxBytes: number): Promise<T> {
  const contentLength = Number(response.headers.get('Content-Length') || '0');
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error('Local Agent response exceeded the allowed size.');
  }
  if (!response.body) return JSON.parse(await response.text()) as T;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new Error('Local Agent response exceeded the allowed size.');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const combined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(decoder.decode(combined)) as T;
}

async function verifyAgentAttestation(payload: HandshakeResponse, trust: LocalAgentTrust) {
  if (
    trust.agentSigningPublicKeyAlgorithm !== 'ED25519' ||
    payload.agentSigningPublicKeyAlgorithm !== 'ED25519' ||
    payload.agentDeviceId?.toLowerCase() !== trust.agentDeviceId.toLowerCase() ||
    payload.restaurantId?.toLowerCase() !== trust.restaurantId.toLowerCase() ||
    payload.agentSigningPublicKey !== trust.agentSigningPublicKey ||
    !payload.agentAttestation
  ) {
    return false;
  }
  const publicKeyBytes = base64UrlToBytes(trust.agentSigningPublicKey);
  const signature = base64UrlToBytes(payload.agentAttestation);
  if (
    publicKeyBytes.byteLength !== 32 ||
    signature.byteLength !== 64 ||
    (await sha256Hex(publicKeyBytes)).toLowerCase() !== trust.agentSigningPublicKeyFingerprint.toLowerCase()
  ) {
    return false;
  }
  const publicKey = await cryptoApi().subtle.importKey('raw', publicKeyBytes, { name: 'Ed25519' }, false, ['verify']);
  const canonical = [
    'edge-channel-attestation-v1',
    payload.agentDeviceId.toLowerCase(),
    payload.restaurantId.toLowerCase(),
    payload.agentPublicKeyFingerprint,
    payload.channelId,
    payload.expiresAt,
  ].join('\n');
  return cryptoApi().subtle.verify('Ed25519', publicKey, signature, encoder.encode(canonical));
}

function channelUsable(identity: StoredPosDeviceIdentity, origin: string, terminalId: string) {
  const channel = identity.localSecureChannel;
  return Boolean(
    channel?.channelId &&
      channel.sessionKey &&
      channel.origin === origin &&
      channel.terminalId === terminalId &&
      Date.parse(channel.expiresAt || '') > Date.now() + CHANNEL_RENEW_LEAD_MS,
  );
}

function secureChannelTerminalId(identity: StoredPosDeviceIdentity, trust?: LocalAgentTrust) {
  return (
    trust?.terminalId?.trim() ||
    identity.localSecureChannel?.terminalId?.trim() ||
    readOrCreateEdgeTerminalIdentity().terminalId
  );
}

function localAgentHandshakeBaseKey(origin: string, terminalId: string, identity: StoredPosDeviceIdentity) {
  return [origin, terminalId.toLowerCase(), identity.publicKeyFingerprint.toLowerCase()].join('\n');
}

function localAgentHandshakeContractKey(
  legacyMigrationCredential: string,
  trust?: LocalAgentTrust,
  expectedRestaurantId?: string,
) {
  return JSON.stringify({
    legacyAvailable: Boolean(legacyMigrationCredential.trim()),
    expectedRestaurantId: (expectedRestaurantId || '').toLowerCase(),
    trust: trust
      ? {
          restaurantId: trust.restaurantId.toLowerCase(),
          agentDeviceId: trust.agentDeviceId.toLowerCase(),
          fingerprint: trust.agentSigningPublicKeyFingerprint.toLowerCase(),
        }
      : null,
  });
}

export async function ensureLocalAgentSecureChannel(
  originValue: string,
  legacyMigrationCredential = '',
  force = false,
  trust?: LocalAgentTrust,
  expectedRestaurantId?: string,
) {
  const origin = normalizeEdgeOrigin(originValue);
  let requireOwnEstablishment = force;
  for (;;) {
    const identity = await readStoredDeviceIdentity();
    if (!identity?.privateKey || !identity.publicKey) return false;
    const terminalId = secureChannelTerminalId(identity, trust);
    if (!requireOwnEstablishment && channelUsable(identity, origin, terminalId)) return true;

    const baseKey = localAgentHandshakeBaseKey(origin, terminalId, identity);
    const contractKey = localAgentHandshakeContractKey(legacyMigrationCredential, trust, expectedRestaurantId);
    const active = localAgentHandshakeFlights.get(baseKey);
    if (active) {
      if (active.contractKey === contractKey) return active.promise;
      await active.promise.catch(() => false);
      // A stricter/different caller never inherits a channel established under
      // another validation contract. Serialize, then perform its own proof.
      requireOwnEstablishment = true;
      continue;
    }

    const promise = establishLocalAgentSecureChannel(
      origin,
      terminalId,
      identity.publicKeyFingerprint,
      legacyMigrationCredential,
      requireOwnEstablishment,
      trust,
      expectedRestaurantId,
    );
    const flight = { contractKey, promise };
    localAgentHandshakeFlights.set(baseKey, flight);
    try {
      return await promise;
    } finally {
      if (localAgentHandshakeFlights.get(baseKey) === flight) localAgentHandshakeFlights.delete(baseKey);
    }
  }
}

async function establishLocalAgentSecureChannel(
  origin: string,
  terminalId: string,
  expectedDeviceFingerprint: string,
  legacyMigrationCredential: string,
  force: boolean,
  trust?: LocalAgentTrust,
  expectedRestaurantId?: string,
) {
  let identity = await readStoredDeviceIdentity();
  if (!identity?.privateKey || !identity.publicKey || identity.publicKeyFingerprint !== expectedDeviceFingerprint) {
    return false;
  }
  if (!force && channelUsable(identity, origin, terminalId)) return true;

  const client = await ensureClientECDH(identity);
  identity = client.identity;
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = randomNonce();
  const canonical = `edge-channel-init-v1\n${terminalId}\n${client.publicKey}\n${timestamp}\n${nonce}`;
  const legacy = legacyMigrationCredential.trim();
  let salt: Uint8Array;
  let authenticationMode: 'LEGACY_PSK' | 'DEVICE_PROOF';
  let authenticationProof: string;
  let deviceBinding: Record<string, unknown> | undefined;
  const canUseDeviceProof = Boolean(
    (identity.localSecureChannel?.agentPublicKey && identity.localSecureChannel.terminalId === terminalId) ||
      (identity.device?.status === 'ACTIVE' && trust),
  );
  if (legacy && !canUseDeviceProof) {
    salt = hexToBytes(await sha256Hex(legacy));
    authenticationMode = 'LEGACY_PSK';
    authenticationProof = await hmacBase64Url(salt, canonical);
    deviceBinding = {
      terminalId,
      publicKeyAlgorithm: 'P256_SHA256',
      publicKey: identity.publicKey,
      deviceName: identity.deviceName,
      platform: identity.platform,
      keyProof: await createPairingKeyProof(identity),
    };
  } else {
    if (!canUseDeviceProof) return false;
    salt = hexToBytes(identity.publicKeyFingerprint);
    authenticationMode = 'DEVICE_PROOF';
    authenticationProof = await signCanonical(identity.privateKey, canonical);
  }

  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), HANDSHAKE_TIMEOUT_MS);
  let response: Response;
  let payload: HandshakeResponse;
  try {
    response = await fetch(`${origin}/v1/pos/devices/secure-channel`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        version: 'v1',
        terminalId,
        clientPublicKey: client.publicKey,
        timestamp,
        nonce,
        authenticationMode,
        authenticationProof,
        ...(deviceBinding ? { deviceBinding } : {}),
      }),
      signal: controller.signal,
    });
    if (!response.ok) return false;
    payload = await readBoundedJSONResponse<HandshakeResponse>(response, HANDSHAKE_MAX_RESPONSE_BYTES);
  } finally {
    globalThis.clearTimeout(timeout);
  }
  if (
    payload.version !== 'v1' ||
    payload.terminalId !== terminalId ||
    payload.agentPublicKeyAlgorithm !== 'P256_ECDH' ||
    !payload.channelId ||
    !payload.serverNonce ||
    Date.parse(payload.expiresAt) <= Date.now()
  ) {
    return false;
  }
  const agentFingerprint = await sha256Hex(base64UrlToBytes(payload.agentPublicKey));
  if (agentFingerprint !== payload.agentPublicKeyFingerprint) return false;
  const restaurantId = (
    expectedRestaurantId ||
    trust?.restaurantId ||
    identity.restaurantContext?.restaurantId ||
    readTransportConnection()?.restaurantId ||
    ''
  ).toLowerCase();
  if (!restaurantId || payload.restaurantId?.toLowerCase() !== restaurantId) return false;
  if (trust && !(await verifyAgentAttestation(payload, trust))) return false;
  const pinnedAgentKey = identity.localSecureChannel?.agentPublicKey;
  if (pinnedAgentKey && pinnedAgentKey !== payload.agentPublicKey) return false;
  const transcript = [
    'edge-channel-v1',
    restaurantId,
    terminalId,
    client.publicKey,
    payload.agentPublicKey,
    timestamp,
    nonce,
    payload.serverNonce,
  ].join('\n');
  const material = await deriveChannelMaterial(client.privateKey, payload.agentPublicKey, salt, transcript);
  try {
    const confirmationCanonical = `edge-channel-confirm-v1\n${transcript}\n${payload.channelId}\n${payload.expiresAt}`;
    if (!(await verifyHmac(material.slice(32), confirmationCanonical, payload.confirmation))) return false;
    const sessionKey = await cryptoApi().subtle.importKey('raw', material.slice(0, 32), 'AES-GCM', false, [
      'encrypt',
      'decrypt',
    ]);
    await updateStoredDeviceIdentity((current) => {
      if (
        current.publicKeyFingerprint !== expectedDeviceFingerprint ||
        current.localSecureChannel?.clientPublicKey !== client.publicKey
      ) {
        throw new Error('POS device identity changed while opening the Local Agent channel.');
      }
      return {
        ...current,
        localSecureChannel: {
          version: 1,
          terminalId,
          origin,
          clientPrivateKey: client.privateKey,
          clientPublicKey: client.publicKey,
          agentPublicKey: payload.agentPublicKey,
          agentPublicKeyFingerprint: payload.agentPublicKeyFingerprint,
          sessionKey,
          channelId: payload.channelId,
          expiresAt: payload.expiresAt,
        },
      };
    });
  } finally {
    material.fill(0);
  }
  markEdgeConnectionSecure(origin);
  return true;
}

function headerValue(headers: AxiosHeaders, name: string) {
  const value = headers.get(name);
  return typeof value === 'string' ? value : '';
}

function requestAAD(method: string, target: string, terminalId: string, channelId: string, nonce: string) {
  return ['edge-channel-v1', 'request', method.toUpperCase(), target, terminalId.toLowerCase(), channelId, nonce].join(
    '\n',
  );
}

export async function protectLocalAxiosRequest(config: AxiosRequestConfig) {
  const baseURL = new URL(config.baseURL || window.location.origin, window.location.origin);
  const origin = normalizeEdgeOrigin(baseURL.origin);
  let identity = await readStoredDeviceIdentity();
  if (!identity || !channelUsable(identity, origin, secureChannelTerminalId(identity))) {
    if (!(await ensureLocalAgentSecureChannel(origin, readLegacyEdgeMigrationCredential()))) {
      throw new Error('Local Agent secure channel is unavailable.');
    }
    identity = await readStoredDeviceIdentity();
  }
  const channel = identity?.localSecureChannel;
  if (!identity || !channel?.sessionKey || !channel.channelId || !channel.terminalId) {
    throw new Error('Local Agent secure channel is unavailable.');
  }
  const headers = normalizedAxiosHeaders(config.headers);
  const method = (config.method || 'GET').toUpperCase();
  const target = resolveRequestTarget(config);
  const { bytes } = await requestBodyBytes(config.data);
  const inner = JSON.stringify({
    body: bytes.byteLength ? bytesToBase64Url(bytes) : '',
    authorization: headerValue(headers, 'Authorization'),
    contentType: headerValue(headers, 'Content-Type'),
    operationId: headerValue(headers, 'X-Edge-Operation-ID'),
    acceptLanguage: headerValue(headers, 'Accept-Language'),
    language: headerValue(headers, 'X-Language'),
  });
  const nonce = cryptoApi().getRandomValues(new Uint8Array(12));
  const nonceText = bytesToBase64Url(nonce);
  const aad = requestAAD(method, target, channel.terminalId, channel.channelId, nonceText);
  const ciphertext = bytesToBase64Url(
    await cryptoApi().subtle.encrypt(
      { name: 'AES-GCM', iv: nonce, additionalData: encoder.encode(aad) },
      channel.sessionKey,
      encoder.encode(inner),
    ),
  );
  for (const name of ['Authorization', 'X-Edge-Operation-ID', 'Accept-Language', 'X-Language']) {
    headers.delete(name);
  }
  headers.set('Content-Type', 'application/json');
  headers.set('X-Edge-Channel-Id', channel.channelId);
  headers.set('X-Edge-Channel-Nonce', nonceText);
  if (method === 'GET' || method === 'HEAD') {
    headers.set('X-Edge-Channel-Payload', ciphertext);
    config.data = undefined;
  } else {
    headers.delete('X-Edge-Channel-Payload');
    config.data = JSON.stringify({ ciphertext });
  }
  config.headers = headers;
  (config as LocalSecureAxiosConfig)._edgeSecureResponseBinding = {
    required: true,
    origin,
    terminalId: channel.terminalId,
    channelId: channel.channelId,
    sessionKey: channel.sessionKey,
  };
  return config;
}

export async function resetLocalAxiosRequestForRetry(config: AxiosRequestConfig) {
  const secureConfig = config as LocalSecureAxiosConfig;
  const requestBinding = secureConfig._edgeSecureResponseBinding;
  const identity = await readStoredDeviceIdentity();
  const channel = identity?.localSecureChannel;
  const sessionKey = requestBinding?.sessionKey ?? channel?.sessionKey;
  const channelId = requestBinding?.channelId ?? channel?.channelId;
  const terminalId = requestBinding?.terminalId ?? channel?.terminalId;
  if (!sessionKey || !channelId || !terminalId) return false;
  const headers = normalizedAxiosHeaders(config.headers);
  const nonceText = headerValue(headers, 'X-Edge-Channel-Nonce');
  const method = (config.method || 'GET').toUpperCase();
  let ciphertext = headerValue(headers, 'X-Edge-Channel-Payload');
  if (!ciphertext && typeof config.data === 'string') {
    try {
      ciphertext = (JSON.parse(config.data) as { ciphertext?: string }).ciphertext || '';
    } catch {
      return false;
    }
  }
  if (!nonceText || !ciphertext) return false;
  const aad = requestAAD(method, resolveRequestTarget(config), terminalId, channelId, nonceText);
  let plaintext: ArrayBuffer;
  try {
    plaintext = await cryptoApi().subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: base64UrlToBytes(nonceText),
        additionalData: encoder.encode(aad),
      },
      sessionKey,
      base64UrlToBytes(ciphertext),
    );
  } catch {
    return false;
  }
  const inner = JSON.parse(decoder.decode(plaintext)) as SecureRequestPlaintext;
  config.data = inner.body ? decoder.decode(base64UrlToBytes(inner.body)) : undefined;
  for (const name of [
    'Authorization',
    'Content-Type',
    'X-Edge-Operation-ID',
    'Accept-Language',
    'X-Language',
    'X-Edge-Channel-Id',
    'X-Edge-Channel-Nonce',
    'X-Edge-Channel-Payload',
    'X-Device-Id',
    'X-Device-Timestamp',
    'X-Device-Nonce',
    'X-Device-Content-SHA256',
    'X-Device-Signature',
  ]) {
    headers.delete(name);
  }
  for (const [name, value] of [
    ['Authorization', inner.authorization],
    ['Content-Type', inner.contentType],
    ['X-Edge-Operation-ID', inner.operationId],
    ['Accept-Language', inner.acceptLanguage],
    ['X-Language', inner.language],
  ]) {
    if (value) headers.set(name, value);
  }
  config.headers = headers;
  delete secureConfig._edgeSecureResponseBinding;
  return true;
}

function responseHeader(response: AxiosResponse, name: string) {
  const headers = response.headers as AxiosHeaders & Record<string, unknown>;
  if (typeof headers.get === 'function') {
    const value = headers.get(name);
    if (typeof value === 'string') return value;
  }
  const value = headers[name.toLowerCase()] ?? headers[name];
  return typeof value === 'string' ? value : '';
}

function plaintextPreChannelErrorAllowed(response: AxiosResponse) {
  if (response.status >= 200 && response.status < 300) return false;
  const code = String((response.data as { code?: unknown } | null)?.code || '');
  return (
    code === 'device_proof_required' ||
    code === 'device_proof_invalid' ||
    code === 'device_binding_required' ||
    code === 'device_id_mismatch' ||
    code === 'device_replay_detected' ||
    code === 'timestamp_invalid' ||
    code === 'timestamp_window' ||
    code === 'nonce_invalid' ||
    code === 'body_too_large' ||
    code === 'body_hash_mismatch' ||
    code === 'stored_key_invalid' ||
    code === 'signature_invalid' ||
    code === 'terminal_revoked' ||
    code.startsWith('secure_channel_') ||
    code.startsWith('channel_')
  );
}

export async function unprotectLocalAxiosResponse<T>(response: AxiosResponse<T>) {
  const binding = (response.config as LocalSecureAxiosConfig)._edgeSecureResponseBinding;
  if (!binding?.required) return response;
  const responseNonce = responseHeader(response, 'X-Edge-Channel-Nonce');
  if (!responseNonce) {
    // Authentication can fail before the Agent has a verified channel context,
    // so only its narrow, non-business proof error contract may be plaintext.
    if (plaintextPreChannelErrorAllowed(response)) return response;
    throw new Error('Local Agent protected response was not encrypted.');
  }
  const envelope = response.data as unknown as { ciphertext?: string };
  if (!envelope?.ciphertext) throw new Error('Local Agent secure response is malformed.');
  const responseNonceBytes = base64UrlToBytes(responseNonce);
  if (responseNonceBytes.byteLength !== 12) throw new Error('Local Agent secure response nonce is invalid.');
  const requestHeaders = normalizedAxiosHeaders(response.config.headers);
  const deviceNonce = headerValue(requestHeaders, 'X-Device-Nonce');
  if (!deviceNonce) throw new Error('Local Agent secure response has no device-proof binding.');
  const method = (response.config.method || 'GET').toUpperCase();
  const target = resolveRequestTarget(response.config);
  const aad = [
    'edge-channel-v1',
    'response',
    method,
    target,
    binding.terminalId.toLowerCase(),
    binding.channelId,
    deviceNonce,
    responseNonce,
    String(response.status),
  ].join('\n');
  const plaintext = await cryptoApi().subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: responseNonceBytes,
      additionalData: encoder.encode(aad),
    },
    binding.sessionKey,
    base64UrlToBytes(envelope.ciphertext),
  );
  const text = decoder.decode(plaintext);
  response.data = (text ? JSON.parse(text) : undefined) as T;
  return response;
}

export async function secureLocalJSONRequest<T>(
  origin: string,
  path: string,
  payload: unknown,
  legacyMigrationCredential = '',
) {
  if (!(await ensureLocalAgentSecureChannel(origin, legacyMigrationCredential))) return null;
  const config: AxiosRequestConfig = {
    baseURL: normalizeEdgeOrigin(origin),
    url: path,
    method: 'POST',
    data: payload,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
  };
  await protectLocalAxiosRequest(config);
  const identity = await readStoredDeviceIdentity();
  const proof = await createDeviceProofHeaders(
    config,
    identity ?? undefined,
    identity?.device ? undefined : readOrCreateEdgeTerminalIdentity().terminalId,
  );
  if (!proof) return null;
  config.data = proof.wireData;
  const headers = normalizedAxiosHeaders(config.headers);
  for (const [name, value] of Object.entries(proof.headers)) headers.set(name, value);
  config.headers = headers;
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), SECURE_REQUEST_TIMEOUT_MS);
  let response: Response;
  let responseData: unknown;
  try {
    response = await fetch(`${normalizeEdgeOrigin(origin)}${path}`, {
      method: 'POST',
      headers: Object.fromEntries(headers) as Record<string, string>,
      body: typeof config.data === 'string' ? config.data : JSON.stringify(config.data),
      signal: controller.signal,
    });
    responseData = await readBoundedJSONResponse(response, SECURE_REQUEST_MAX_RESPONSE_BYTES);
  } finally {
    globalThis.clearTimeout(timeout);
  }
  const axiosLike = {
    data: responseData,
    status: response.status,
    statusText: response.statusText,
    headers: Object.fromEntries(response.headers.entries()),
    config,
  } as AxiosResponse<T>;
  await unprotectLocalAxiosResponse(axiosLike);
  return { ok: response.ok, status: response.status, data: axiosLike.data };
}
