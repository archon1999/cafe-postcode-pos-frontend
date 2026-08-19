// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';

import {
  EDGE_ORIGIN_STORAGE_KEY,
  LEGACY_EDGE_MIGRATION_CREDENTIAL_STORAGE_KEY,
  ignoreMismatchedAgent,
  normalizeEdgeOrigin,
  persistTransportConnection,
  readLegacyEdgeMigrationCredential,
  readStoredEdgeOrigin,
  readTransportConnection,
} from './edgeConnection';

describe('edge connection origin migration', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it.each([
    'http://127.0.0.1:18181/v1',
    'http://127.0.0.1:18181/api',
    'http://127.0.0.1:18181/api/v1',
    'http://127.0.0.1:18181/v1/api',
  ])('normalizes a legacy API path in %s', (origin) => {
    expect(normalizeEdgeOrigin(origin)).toBe('http://127.0.0.1:18181');
  });

  it('migrates a malformed stored origin before API URL resolution', () => {
    window.localStorage.setItem(EDGE_ORIGIN_STORAGE_KEY, 'http://127.0.0.1:18181/v1/api');

    expect(readStoredEdgeOrigin()).toBe('http://127.0.0.1:18181');
    expect(window.localStorage.getItem(EDGE_ORIGIN_STORAGE_KEY)).toBe('http://127.0.0.1:18181');
  });

  it('drops an unsafe stored origin', () => {
    window.localStorage.setItem(EDGE_ORIGIN_STORAGE_KEY, 'file:///C:/Windows');

    expect(readStoredEdgeOrigin()).toBe('');
    expect(window.localStorage.getItem(EDGE_ORIGIN_STORAGE_KEY)).toBeNull();
  });

  it('ignores an agent that belongs to another selected restaurant', () => {
    persistTransportConnection({
      mode: 'router',
      restaurantId: 'restaurant-x',
      origin: 'http://192.168.1.20:18181',
      secureChannel: true,
    });
    window.localStorage.setItem(LEGACY_EDGE_MIGRATION_CREDENTIAL_STORAGE_KEY, 'ept_x');

    ignoreMismatchedAgent('restaurant-y');

    expect(readTransportConnection()).toMatchObject({ mode: 'remote', restaurantId: 'restaurant-y' });
    expect(readStoredEdgeOrigin()).toBe('');
    expect(readLegacyEdgeMigrationCredential()).toBe('');
  });
});
