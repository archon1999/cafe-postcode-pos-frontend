import { beforeEach, describe, expect, it, vi } from 'vitest';

const { apiGetMock, useQueryMock } = vi.hoisted(() => ({
  apiGetMock: vi.fn(),
  useQueryMock: vi.fn((options) => options),
}));

vi.mock('@tanstack/react-query', () => ({ useQuery: useQueryMock }));
vi.mock('shared/api/client', () => ({ apiGet: apiGetMock }));

import { systemHealthQueryKey, useSystemHealthQuery } from './queries';
import { deriveSystemHealthTone } from './status';
import type { EdgeSystemStatus } from './types';

function snapshot(overrides?: Partial<EdgeSystemStatus>): EdgeSystemStatus {
  return {
    agent: { online: true, version: '0.7.9' },
    backend: { online: true, offlineMode: false },
    sync: { ready: true, pendingOutbox: 0, failedOutbox: 0, schemaVersion: 1 },
    fiscal: { configured: false, online: false, state: 'not_configured' },
    marta: { configured: false, online: false, state: 'not_configured' },
    printer: { configured: false, online: false, state: 'not_configured' },
    ...overrides,
  };
}

describe('POS diagnostics characterization', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    useQueryMock.mockClear();
  });

  it.each([
    ['request failed', undefined, true, 'error'],
    ['agent offline', snapshot({ agent: { online: false, version: '0.7.9' } }), false, 'error'],
    [
      'failed outbox',
      snapshot({ sync: { ready: true, pendingOutbox: 0, failedOutbox: 1, schemaVersion: 1 } }),
      false,
      'error',
    ],
    [
      'configured integration offline',
      snapshot({ fiscal: { configured: true, online: false, state: 'offline' } }),
      false,
      'warning',
    ],
    [
      'backend offline with local data ready',
      snapshot({ backend: { online: false, offlineMode: true } }),
      false,
      'offline',
    ],
    [
      'pending outbox',
      snapshot({ sync: { ready: true, pendingOutbox: 1, failedOutbox: 0, schemaVersion: 1 } }),
      false,
      'success',
    ],
    [
      'bootstrap not ready',
      snapshot({ sync: { ready: false, pendingOutbox: 0, failedOutbox: 0, schemaVersion: 1 } }),
      false,
      'success',
    ],
    ['healthy', snapshot(), false, 'success'],
  ] as const)('%s has the current badge priority', (_name, status, requestFailed, expected) => {
    expect(deriveSystemHealthTone(status, requestFailed, { ignoreSync: true })).toBe(expected);
  });

  it('polls the transport-selected system status only while the page is foregrounded', async () => {
    const options = useSystemHealthQuery({ enabled: true }) as unknown as {
      queryKey: readonly string[];
      queryFn: () => Promise<unknown>;
      enabled: boolean;
      retry: boolean;
      refetchInterval: number;
      refetchIntervalInBackground: boolean;
    };
    apiGetMock.mockResolvedValue({ ok: true, status: snapshot() });

    expect(options.queryKey).toBe(systemHealthQueryKey);
    expect(options.enabled).toBe(true);
    expect(options.retry).toBe(false);
    expect(options.refetchInterval).toBe(60_000);
    expect(options.refetchIntervalInBackground).toBe(false);
    await options.queryFn();
    expect(apiGetMock).toHaveBeenCalledWith('/system/status');
  });
});
