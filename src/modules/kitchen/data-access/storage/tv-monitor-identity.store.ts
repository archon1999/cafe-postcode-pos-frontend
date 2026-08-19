import type { TvMonitorDevice, TvMonitorPairingSession, TvMonitorRestaurantContext } from 'modules/kitchen/domain';

const DATABASE_NAME = 'cafe-postcode-tv-monitor-device';
const DATABASE_VERSION = 1;
const STORE_NAME = 'identity';
const PRIMARY_KEY = 'primary';

export type StoredTvMonitorIdentity = {
  storageKey: typeof PRIMARY_KEY;
  schemaVersion: 1;
  privateKey: CryptoKey;
  publicKey: string;
  publicKeyFingerprint: string;
  deviceName: string;
  platform: string;
  appVersion: string;
  createdAt: string;
  device?: TvMonitorDevice;
  restaurantContext?: TvMonitorRestaurantContext;
  pairing?: TvMonitorPairingSession;
};

let databasePromise: Promise<IDBDatabase> | null = null;

function indexedDb() {
  if (typeof window === 'undefined' || !window.indexedDB) {
    throw new Error('Bu brauzer xavfsiz TV qurilma kalitlarini saqlashni qo‘llamaydi.');
  }
  return window.indexedDB;
}

function openDatabase() {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDb().open(DATABASE_NAME, DATABASE_VERSION);
    request.onerror = () => reject(request.error ?? new Error('TV qurilma kalitlari bazasini ochib bo‘lmadi.'));
    request.onblocked = () => reject(new Error('TV qurilma kalitlari bazasi boshqa oynada band.'));
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
    transaction.onerror = () => reject(transaction.error ?? new Error('TV qurilma kalitlari bazasida xatolik.'));
    execute(transaction.objectStore(STORE_NAME), resolve, reject);
  });
}

export async function readStoredTvMonitorIdentity(): Promise<StoredTvMonitorIdentity | null> {
  return withStore<StoredTvMonitorIdentity | null>('readonly', (store, resolve, reject) => {
    const request = store.get(PRIMARY_KEY);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const value = request.result as StoredTvMonitorIdentity | undefined;
      if (!value || value.schemaVersion !== 1 || !(value.privateKey instanceof CryptoKey)) {
        resolve(null);
        return;
      }
      resolve(value);
    };
  });
}

export async function persistTvMonitorIdentity(
  identity: Omit<StoredTvMonitorIdentity, 'storageKey' | 'schemaVersion'>,
): Promise<StoredTvMonitorIdentity> {
  const value: StoredTvMonitorIdentity = { ...identity, storageKey: PRIMARY_KEY, schemaVersion: 1 };
  await withStore<void>('readwrite', (store, resolve, reject) => {
    const request = store.put(value);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
  return value;
}

export async function clearStoredTvMonitorIdentity() {
  await withStore<void>('readwrite', (store, resolve, reject) => {
    const request = store.delete(PRIMARY_KEY);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export function resetTvMonitorIdentityDatabaseForTests() {
  databasePromise?.then((database) => database.close()).catch(() => undefined);
  databasePromise = null;
}
