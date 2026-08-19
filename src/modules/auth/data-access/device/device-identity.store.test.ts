// @vitest-environment jsdom

import { webcrypto } from 'node:crypto';

import 'fake-indexeddb/auto';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import {
  clearStoredDeviceIdentity,
  persistDeviceIdentity,
  readStoredDeviceIdentity,
  resetDeviceIdentityDatabaseForTests,
  updateStoredDeviceIdentity,
} from './device-identity.store';
import { createPosDeviceIdentity } from './device-proof';

beforeAll(() => {
  Object.defineProperty(window, 'crypto', { configurable: true, value: webcrypto });
});

afterEach(async () => {
  await clearStoredDeviceIdentity().catch(() => undefined);
  resetDeviceIdentityDatabaseForTests();
});

describe('POS device identity storage', () => {
  it('serializes concurrent read-modify-write updates in one IndexedDB transaction', async () => {
    const identity = await createPosDeviceIdentity();
    await persistDeviceIdentity({ ...identity, appVersion: '' });

    await Promise.all(
      Array.from({ length: 24 }, (_, index) =>
        updateStoredDeviceIdentity((current) => ({
          ...current,
          appVersion: `${current.appVersion}|${index}`,
        })),
      ),
    );

    const stored = await readStoredDeviceIdentity();
    const applied = new Set((stored?.appVersion || '').split('|').filter(Boolean).map(Number));
    expect(applied).toEqual(new Set(Array.from({ length: 24 }, (_, index) => index)));
  });
});
