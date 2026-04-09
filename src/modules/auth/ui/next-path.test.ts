import { describe, expect, it } from 'vitest';

import { resolveAuthNextPath } from './next-path';

describe('resolveAuthNextPath', () => {
  it('returns the provided internal path', () => {
    expect(resolveAuthNextPath('?next=%2Fmonitor%2Fqueue')).toBe('/monitor/queue');
  });

  it('falls back for external targets', () => {
    expect(resolveAuthNextPath('?next=https://example.com')).toBe('/pin-login');
    expect(resolveAuthNextPath('?next=//example.com')).toBe('/pin-login');
  });

  it('uses the custom fallback when next is absent', () => {
    expect(resolveAuthNextPath('', '/monitor/queue')).toBe('/monitor/queue');
  });
});
