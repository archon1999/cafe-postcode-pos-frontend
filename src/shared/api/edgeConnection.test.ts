// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';

import { EDGE_ORIGIN_STORAGE_KEY, normalizeEdgeOrigin, readStoredEdgeOrigin } from './edgeConnection';

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
});
