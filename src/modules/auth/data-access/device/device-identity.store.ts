import type { PosDevice, PosDevicePairing, PosRestaurantContext } from '../../domain/entities';

const DATABASE_NAME = 'cafe-postcode-pos-device';
const DATABASE_VERSION = 1;
const STORE_NAME = 'identity';
const PRIMARY_KEY = 'primary';

export type StoredPosDeviceIdentity = {
  storageKey: typeof PRIMARY_KEY;
  schemaVersion: 1;
  privateKey: CryptoKey;
  publicKey: string;
  publicKeyFingerprint: string;
  deviceName: string;
  platform: string;
  appVersion: string;
  createdAt: string;
  device?: PosDevice;
  restaurantContext?: PosRestaurantContext;
  pairing?: PosDevicePairing;
  localSecureChannel?: {
    version: 1;
    clientPrivateKey: CryptoKey;
    clientPublicKey: string;
    terminalId?: string;
    origin?: string;
    agentPublicKey?: string;
    agentPublicKeyFingerprint?: string;
    sessionKey?: CryptoKey;
    channelId?: string;
    expiresAt?: string;
  };
};

let databasePromise: Promise<IDBDatabase> | null = null;

function indexedDb() {
  if (typeof window === 'undefined' || !window.indexedDB) {
    throw new Error('Bu brauzer xavfsiz qurilma kalitlarini saqlashni qo‘llamaydi.');
  }
  return window.indexedDB;
}

function openDatabase() {
  if (databasePromise) return databasePromise;

  databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDb().open(DATABASE_NAME, DATABASE_VERSION);
    request.onerror = () => reject(request.error ?? new Error('Qurilma kalitlari bazasini ochib bo‘lmadi.'));
    request.onblocked = () => reject(new Error('Qurilma kalitlari bazasi boshqa oynada band.'));
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: 'storageKey' });
      }
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
  });

  return databasePromise;
}

async function withStore<T>(
  mode: IDBTransactionMode,
  execute: (store: IDBObjectStore, resolve: (value: T) => void, reject: (reason?: unknown) => void) => void,
) {
  const database = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    transaction.onerror = () => reject(transaction.error ?? new Error('Qurilma kalitlari bazasida xatolik.'));
    execute(transaction.objectStore(STORE_NAME), resolve, reject);
  });
}

export async function readStoredDeviceIdentity(): Promise<StoredPosDeviceIdentity | null> {
  return withStore<StoredPosDeviceIdentity | null>('readonly', (store, resolve, reject) => {
    const request = store.get(PRIMARY_KEY);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const value = request.result as StoredPosDeviceIdentity | undefined;
      if (!value || value.schemaVersion !== 1 || !(value.privateKey instanceof CryptoKey)) {
        resolve(null);
        return;
      }
      resolve(value);
    };
  });
}

export async function persistDeviceIdentity(
  identity: Omit<StoredPosDeviceIdentity, 'storageKey' | 'schemaVersion'>,
): Promise<StoredPosDeviceIdentity> {
  const value: StoredPosDeviceIdentity = { ...identity, storageKey: PRIMARY_KEY, schemaVersion: 1 };
  await withStore<void>('readwrite', (store, resolve, reject) => {
    const request = store.put(value);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
  return value;
}

export async function updateStoredDeviceIdentity(
  update: (current: StoredPosDeviceIdentity) => StoredPosDeviceIdentity,
): Promise<StoredPosDeviceIdentity> {
  const database = await openDatabase();
  return new Promise<StoredPosDeviceIdentity>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    let next: StoredPosDeviceIdentity | null = null;
    let settled = false;
    const fail = (reason: unknown) => {
      if (settled) return;
      settled = true;
      reject(reason);
    };

    transaction.onerror = () => fail(transaction.error ?? new Error('Qurilma kalitlari bazasida xatolik.'));
    transaction.onabort = () => fail(transaction.error ?? new Error('Qurilma kalitlari yangilanmadi.'));
    transaction.oncomplete = () => {
      if (!settled && next) {
        settled = true;
        resolve(next);
      }
    };

    const readRequest = store.get(PRIMARY_KEY);
    readRequest.onerror = () => fail(readRequest.error ?? new Error('Qurilma kaliti o‘qilmadi.'));
    readRequest.onsuccess = () => {
      const current = readRequest.result as StoredPosDeviceIdentity | undefined;
      if (!current || current.schemaVersion !== 1 || !(current.privateKey instanceof CryptoKey)) {
        transaction.abort();
        fail(new Error('Qurilma kaliti topilmadi. Qurilmani qayta ulang.'));
        return;
      }
      try {
        next = update(current);
        store.put(next);
      } catch (error) {
        transaction.abort();
        fail(error);
      }
    };
  });
}

export async function clearStoredDeviceIdentity() {
  await withStore<void>('readwrite', (store, resolve, reject) => {
    const request = store.delete(PRIMARY_KEY);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export function resetDeviceIdentityDatabaseForTests() {
  databasePromise?.then((database) => database.close()).catch(() => undefined);
  databasePromise = null;
}
