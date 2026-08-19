import type { AxiosRequestConfig } from 'axios';

import { readStoredDeviceIdentity, type StoredPosDeviceIdentity } from './device-identity.store';

const encoder = new TextEncoder();
const EMPTY_BODY_HASH = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

function cryptoApi() {
  const value = globalThis.crypto;
  if (!value?.subtle || typeof value.getRandomValues !== 'function') {
    throw new Error('Qurilmani xavfsiz ulash uchun Web Crypto mavjud emas. HTTPS orqali oching.');
  }
  return value;
}

export function bytesToBase64Url(bytes: ArrayBuffer | Uint8Array) {
  const value = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function base64UrlToBytes(value: string) {
  const padded = value
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export async function sha256Hex(value: string | Uint8Array) {
  const bytes = typeof value === 'string' ? encoder.encode(value) : value;
  const digest = new Uint8Array(await cryptoApi().subtle.digest('SHA-256', bytes));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function randomNonce(byteLength = 32) {
  return bytesToBase64Url(cryptoApi().getRandomValues(new Uint8Array(byteLength)));
}

export async function signCanonical(privateKey: CryptoKey, canonical: string) {
  const signature = await cryptoApi().subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    encoder.encode(canonical),
  );
  return bytesToBase64Url(signature);
}

function detectedDeviceName() {
  const platform =
    (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ||
    navigator.platform ||
    'Web';
  return `${platform} POS`;
}

function detectedPlatform() {
  return (
    (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ||
    navigator.platform ||
    'web'
  );
}

export async function createPosDeviceIdentity(): Promise<StoredPosDeviceIdentity> {
  const keys = await cryptoApi().subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
  const publicKeyBytes = new Uint8Array(await cryptoApi().subtle.exportKey('spki', keys.publicKey));
  const publicKey = bytesToBase64Url(publicKeyBytes);
  const appVersion = String(import.meta.env.VITE_APP_VERSION || 'web');
  return {
    storageKey: 'primary',
    schemaVersion: 1,
    privateKey: keys.privateKey,
    publicKey,
    publicKeyFingerprint: await sha256Hex(publicKeyBytes),
    deviceName: detectedDeviceName(),
    platform: detectedPlatform(),
    appVersion,
    createdAt: new Date().toISOString(),
  };
}

export async function createPairingKeyProof(identity: StoredPosDeviceIdentity) {
  const nonce = randomNonce();
  const canonical = `pairing-v1\n${nonce}\n${identity.publicKeyFingerprint}`;
  return { nonce, signature: await signCanonical(identity.privateKey, canonical) };
}

export async function createPairingStatusProof(
  identity: StoredPosDeviceIdentity,
  pairingId: string,
  pollToken: string,
) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = randomNonce();
  const pollTokenHash = await sha256Hex(pollToken);
  const canonical = `pairing-status-v1\n${pairingId}\n${timestamp}\n${nonce}\n${pollTokenHash}`;
  return { timestamp, nonce, signature: await signCanonical(identity.privateKey, canonical) };
}

export async function requestBodyBytes(data: unknown): Promise<{ bytes: Uint8Array; wireData: unknown }> {
  if (data === undefined || data === null) return { bytes: new Uint8Array(), wireData: data };
  if (typeof data === 'string') return { bytes: encoder.encode(data), wireData: data };
  if (data instanceof URLSearchParams) {
    const wireData = data.toString();
    return { bytes: encoder.encode(wireData), wireData };
  }
  if (data instanceof ArrayBuffer) return { bytes: new Uint8Array(data), wireData: data };
  if (ArrayBuffer.isView(data)) {
    const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    return { bytes, wireData: data };
  }
  if (typeof Blob !== 'undefined' && data instanceof Blob) {
    return { bytes: new Uint8Array(await data.arrayBuffer()), wireData: data };
  }
  if (typeof FormData !== 'undefined' && data instanceof FormData) {
    throw new Error('Device-proof FormData so‘rovlarini qo‘llamaydi. JSON yoki Blob yuboring.');
  }
  const wireData = JSON.stringify(data);
  return { bytes: encoder.encode(wireData), wireData };
}

export function resolveRequestTarget(config: AxiosRequestConfig) {
  const requestUrl = config.url || '';
  const combinedUrl = /^https?:\/\//i.test(requestUrl)
    ? requestUrl
    : `${(config.baseURL || window.location.origin).replace(/\/$/, '')}/${requestUrl.replace(/^\//, '')}`;
  const absoluteUrl = new URL(combinedUrl, window.location.origin);
  if (config.params) {
    const uri = new URL(
      `${config.baseURL?.replace(/\/$/, '') || ''}/${(config.url || '').replace(/^\//, '')}`,
      window.location.origin,
    );
    const entries = config.params instanceof URLSearchParams ? config.params : new URLSearchParams(config.params);
    for (const [key, value] of entries) uri.searchParams.append(key, value);
    return `${uri.pathname}${uri.search}`;
  }
  return `${absoluteUrl.pathname}${absoluteUrl.search}`;
}

export async function createDeviceProofHeaders(
  config: AxiosRequestConfig,
  identityOverride?: StoredPosDeviceIdentity,
  deviceIdOverride?: string,
) {
  const identity = identityOverride ?? (await readStoredDeviceIdentity());
  if (!identity?.privateKey) return null;
  const selectedDeviceId = deviceIdOverride?.trim() || identity.device?.id || '';
  if (!selectedDeviceId || (!deviceIdOverride && identity.device?.status !== 'ACTIVE')) return null;

  const method = (config.method || 'GET').toUpperCase();
  const requestTarget = resolveRequestTarget(config);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = randomNonce();
  const { bytes, wireData } = await requestBodyBytes(config.data);
  const bodyHash = bytes.byteLength ? await sha256Hex(bytes) : EMPTY_BODY_HASH;
  const deviceId = selectedDeviceId.toLowerCase();
  const canonical = `v1\n${method}\n${requestTarget}\n${deviceId}\n${timestamp}\n${nonce}\n${bodyHash}`;

  return {
    wireData,
    headers: {
      'X-Device-Id': deviceId,
      'X-Device-Timestamp': timestamp,
      'X-Device-Nonce': nonce,
      'X-Device-Content-SHA256': bodyHash,
      'X-Device-Signature': await signCanonical(identity.privateKey, canonical),
    },
  };
}
