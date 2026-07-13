import { describe, expect, it } from 'vitest';

import { isVersionedApiBaseUrl } from './apiUrl';

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
});
