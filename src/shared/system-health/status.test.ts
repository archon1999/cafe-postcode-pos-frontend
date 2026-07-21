import { describe, expect, it } from 'vitest';

import { deriveSystemHealthTone } from './status';
import type { EdgeSystemStatus } from './types';

function status(overrides?: Partial<EdgeSystemStatus>): EdgeSystemStatus {
  return {
    agent: { online: true, version: '1.0.0' },
    backend: { online: true, offlineMode: false },
    sync: { ready: true, pendingOutbox: 0, failedOutbox: 0, schemaVersion: 1 },
    fiscal: { configured: true, online: true, state: 'online' },
    marta: { configured: false, online: false, state: 'not_configured' },
    printer: { configured: false, online: false, state: 'not_configured' },
    ...overrides,
  };
}

describe('deriveSystemHealthTone', () => {
  it('uses error when the local agent request fails', () => {
    expect(deriveSystemHealthTone(undefined, true)).toBe('error');
  });

  it('uses warning when a configured integration is offline', () => {
    expect(deriveSystemHealthTone(status({ fiscal: { configured: true, online: false, state: 'offline' } }))).toBe(
      'warning',
    );
  });

  it('uses the secondary offline tone when local operations remain available', () => {
    expect(deriveSystemHealthTone(status({ backend: { online: false, offlineMode: true } }))).toBe('offline');
  });

  it('gives an integration warning priority over offline mode', () => {
    expect(
      deriveSystemHealthTone(
        status({
          backend: { online: false, offlineMode: true },
          fiscal: { configured: true, online: false, state: 'offline' },
        }),
      ),
    ).toBe('warning');
  });

  it('uses error for failed sync operations', () => {
    expect(
      deriveSystemHealthTone(status({ sync: { ready: true, pendingOutbox: 0, failedOutbox: 1, schemaVersion: 1 } })),
    ).toBe('error');
  });

  it('ignores sync failures, pending operations, and readiness for badge tone', () => {
    expect(
      deriveSystemHealthTone(
        status({ sync: { ready: false, pendingOutbox: 2, failedOutbox: 1, schemaVersion: 1 } }),
        false,
        { ignoreSync: true },
      ),
    ).toBe('success');
  });
});
