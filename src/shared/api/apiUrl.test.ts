import { afterEach, describe, expect, it, vi } from 'vitest';

import { isVersionedApiBaseUrl, resolveRemoteApiBaseUrl } from './apiUrl';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('isVersionedApiBaseUrl', () => {
  it.each([
    'http://127.0.0.1:18181/v1',
    'https://cafe-postcode.uz/api/v1',
    'https://example.test/api/v2/resource',
  ])('accepts versioned API base %s', (value) => {
    expect(isVersionedApiBaseUrl(value)).toBe(true);
  });

  it.each(['http://127.0.0.1:18181', 'https://cafe-postcode.uz/api'])('rejects unversioned base %s', (value) => {
    expect(isVersionedApiBaseUrl(value)).toBe(false);
  });

  it('uses the explicit remote API base even when the main API base points to the local agent', () => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://127.0.0.1:18181/v1');
    vi.stubEnv('VITE_REMOTE_API_BASE_URL', 'https://cafe-postcode.uz/api/v1');

    expect(resolveRemoteApiBaseUrl()).toBe('https://cafe-postcode.uz/api/v1');
  });
});
