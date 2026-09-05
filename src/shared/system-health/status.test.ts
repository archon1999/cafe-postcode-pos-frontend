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

  it('uses warning for operations that need an operator decision', () => {
    expect(
      deriveSystemHealthTone(
        status({
          sync: {
            ready: true,
            pendingOutbox: 0,
            failedOutbox: 1,
            actionRequiredOutbox: 1,
            quarantinedOutbox: 0,
            schemaVersion: 1,
          },
        }),
      ),
    ).toBe('warning');
  });

  it('uses error only for quarantined operations when lifecycle counters are present', () => {
    expect(
      deriveSystemHealthTone(
        status({
          sync: {
            ready: true,
            pendingOutbox: 0,
            failedOutbox: 1,
            actionRequiredOutbox: 2,
            quarantinedOutbox: 1,
            schemaVersion: 1,
          },
        }),
      ),
    ).toBe('error');
  });

  it('keeps quarantined failures visible even when routine sync is ignored for the badge', () => {
    expect(
      deriveSystemHealthTone(
        status({ sync: { ready: false, pendingOutbox: 2, failedOutbox: 1, schemaVersion: 1 } }),
        false,
        { ignoreSync: true },
      ),
    ).toBe('error');
  });

  it('does not paint a reachable fiscal device green while its result is unknown', () => {
    expect(deriveSystemHealthTone(status({ fiscal: { configured: true, online: true, state: 'unknown' } }))).toBe(
      'warning',
    );
  });

  it('shows unknown financial commands even with an empty backend outbox', () => {
    expect(
      deriveSystemHealthTone(
        status({
          sync: { ready: true, pendingOutbox: 0, failedOutbox: 0, schemaVersion: 1, unknownFinancialCommands: 1 },
        }),
        false,
        { ignoreSync: true },
      ),
    ).toBe('error');
  });

  it('does not equate an unavailable OFD queue count with an empty queue', () => {
    expect(
      deriveSystemHealthTone(status({ fiscalQueue: { known: false, pendingReceipts: null, lastError: 'timeout' } })),
    ).toBe('warning');
  });
});
