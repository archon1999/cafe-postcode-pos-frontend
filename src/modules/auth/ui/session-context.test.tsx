// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  persistPosLastActivityAt,
  POS_LAST_ACTIVITY_STORAGE_KEY,
  POS_SESSION_LOCK_STORAGE_KEY,
} from '../data-access/storage/session-security';
import type { PosDeviceBinding } from '../domain';

import { POS_IDLE_LOCK_MS, PosSessionProvider, usePosSession } from './session-context';

const repositoryMocks = vi.hoisted(() => ({
  clearDeviceIdentity: vi.fn(),
  createDevicePairing: vi.fn(),
  lockSession: vi.fn(),
  loginWithPin: vi.fn(),
  logoutSession: vi.fn(),
  readDevicePairingStatus: vi.fn(),
  restoreDeviceBinding: vi.fn(),
  tryLegacyDeviceMigration: vi.fn(),
  unlockSession: vi.fn(),
}));
const readIdentityMock = vi.hoisted(() => vi.fn());

vi.mock('modules/auth/data-access', async () => {
  const actual = await vi.importActual<typeof import('modules/auth/data-access')>('modules/auth/data-access');
  return { ...actual, authRepository: repositoryMocks };
});

vi.mock('modules/auth/data-access/device', async () => {
  const actual = await vi.importActual<typeof import('modules/auth/data-access/device')>(
    'modules/auth/data-access/device',
  );
  return { ...actual, readStoredDeviceIdentity: (...args: unknown[]) => readIdentityMock(...args) };
});

const binding: PosDeviceBinding = {
  device: {
    id: '11111111-1111-4111-8111-111111111111',
    type: 'POS_TERMINAL',
    name: 'Cashbox',
    status: 'ACTIVE',
    leaseExpiresAt: '2030-01-01T00:00:00.000Z',
  },
  restaurantContext: { restaurantId: 'restaurant-1', restaurantName: 'Cafe' },
};

function Consumer() {
  const context = usePosSession();
  return (
    <div>
      <div data-testid="state">{context.authState}</div>
      <div data-testid="token">{context.session?.token || 'none'}</div>
      <div data-testid="restaurant">{context.restaurantContext?.restaurantId || 'none'}</div>
      <button onClick={() => void context.lockSession()}>lock</button>
      <button onClick={() => void context.unlockSession('1234')}>unlock</button>
      <button onClick={() => void context.changeUser()}>change</button>
    </div>
  );
}

async function renderProvider() {
  const rendered = render(
    <PosSessionProvider>
      <Consumer />
    </PosSessionProvider>,
  );
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  return rendered;
}

describe('POS session state and locking', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    Object.values(repositoryMocks).forEach((mock) => mock.mockReset());
    readIdentityMock.mockReset();
    readIdentityMock.mockResolvedValue({ device: binding.device });
    repositoryMocks.restoreDeviceBinding.mockResolvedValue(binding);
    repositoryMocks.lockSession.mockResolvedValue(undefined);
    repositoryMocks.logoutSession.mockResolvedValue(undefined);
    repositoryMocks.tryLegacyDeviceMigration.mockResolvedValue(null);
    repositoryMocks.unlockSession.mockResolvedValue({
      token: 'rotated-token',
      user: { id: 'user-1', username: 'cashier', fullName: 'Cashier', permissionCodes: [] },
    });
    sessionStorage.setItem(
      'restaurant-pos-session',
      JSON.stringify({
        token: 'original-token',
        user: { id: 'user-1', username: 'cashier', fullName: 'Cashier', permissionCodes: [] },
        restaurantContext: binding.restaurantContext,
      }),
    );
    persistPosLastActivityAt();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('restores restaurant context from the paired device instead of a restaurant code', async () => {
    await renderProvider();

    expect(screen.getByTestId('state').textContent).toBe('AUTHENTICATED');
    expect(screen.getByTestId('restaurant').textContent).toBe('restaurant-1');
    expect(repositoryMocks.restoreDeviceBinding).toHaveBeenCalledOnce();
  });

  it('locks after 15 minutes of inactivity, keeps only the locked session, and requires rotated PIN unlock', async () => {
    await renderProvider();
    vi.useFakeTimers();
    fireEvent.pointerMove(window);

    await act(async () => {
      vi.advanceTimersByTime(POS_IDLE_LOCK_MS - 1);
    });
    expect(screen.getByTestId('state').textContent).toBe('AUTHENTICATED');

    await act(async () => {
      vi.advanceTimersByTime(1);
      await Promise.resolve();
    });
    expect(repositoryMocks.lockSession).toHaveBeenCalledOnce();
    expect(screen.getByTestId('state').textContent).toBe('LOCKED');
    expect(screen.getByTestId('token').textContent).toBe('original-token');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'unlock' }));
      await Promise.resolve();
    });
    expect(repositoryMocks.lockSession).toHaveBeenCalledTimes(2);
    expect(repositoryMocks.unlockSession).toHaveBeenCalledWith({ pin: '1234' });
    expect(screen.getByTestId('state').textContent).toBe('AUTHENTICATED');
    expect(screen.getByTestId('token').textContent).toBe('rotated-token');
  });

  it('does not let the first input after browser suspension reset an elapsed idle window', async () => {
    await renderProvider();
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + POS_IDLE_LOCK_MS + 1);

    await act(async () => {
      fireEvent.pointerDown(window);
      await Promise.resolve();
    });

    expect(repositoryMocks.lockSession).toHaveBeenCalledOnce();
    expect(screen.getByTestId('state').textContent).toBe('LOCKED');
  });

  it('keeps the absolute idle deadline across a full provider reload and locks exactly at 15 minutes', async () => {
    vi.useFakeTimers();
    const startedAt = Date.parse('2026-08-17T05:00:00.000Z');
    vi.setSystemTime(startedAt);
    persistPosLastActivityAt(startedAt);
    const firstMount = await renderProvider();
    firstMount.unmount();

    vi.setSystemTime(startedAt + POS_IDLE_LOCK_MS - 1_000);
    await renderProvider();
    window.dispatchEvent(new Event('online'));
    window.dispatchEvent(new Event('focus'));

    await act(async () => {
      vi.advanceTimersByTime(999);
      await Promise.resolve();
    });
    expect(repositoryMocks.lockSession).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1);
      await Promise.resolve();
    });
    expect(repositoryMocks.lockSession).toHaveBeenCalledOnce();
    expect(screen.getByTestId('state').textContent).toBe('LOCKED');
  });

  it.each([
    ['missing', null],
    ['future', JSON.stringify({ version: 1, at: Date.parse('2026-08-18T05:00:00.000Z') })],
    ['malformed', '{not-json'],
  ])('locks an existing session on reload when its activity epoch is %s', async (_caseName, storedValue) => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.parse('2026-08-17T05:00:00.000Z'));
    if (storedValue === null) localStorage.removeItem(POS_LAST_ACTIVITY_STORAGE_KEY);
    else localStorage.setItem(POS_LAST_ACTIVITY_STORAGE_KEY, storedValue);

    await renderProvider();
    await act(async () => {
      await Promise.resolve();
    });

    expect(repositoryMocks.lockSession).toHaveBeenCalledOnce();
    expect(screen.getByTestId('state').textContent).toBe('LOCKED');
    expect(screen.getByTestId('token').textContent).toBe('original-token');
  });

  it('keeps an in-memory idle deadline when activity storage becomes unavailable', async () => {
    vi.useFakeTimers();
    const startedAt = Date.parse('2026-08-17T07:00:00.000Z');
    vi.setSystemTime(startedAt);
    persistPosLastActivityAt(startedAt);
    await renderProvider();

    const originalSetItem = Storage.prototype.setItem;
    const storageFailure = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage,
      key,
      value,
    ) {
      if (this === localStorage && key === POS_LAST_ACTIVITY_STORAGE_KEY) {
        throw new DOMException('Denied', 'SecurityError');
      }
      return originalSetItem.call(this, key, value);
    });
    try {
      vi.setSystemTime(startedAt + 1_000);
      fireEvent.pointerDown(window);
      await act(async () => {
        vi.advanceTimersByTime(POS_IDLE_LOCK_MS - 1);
        await Promise.resolve();
      });
      expect(repositoryMocks.lockSession).not.toHaveBeenCalled();

      await act(async () => {
        vi.advanceTimersByTime(1);
        await Promise.resolve();
      });
      expect(repositoryMocks.lockSession).toHaveBeenCalledOnce();
      expect(screen.getByTestId('state').textContent).toBe('LOCKED');
    } finally {
      storageFailure.mockRestore();
    }
  });

  it('locks fail-closed when activity storage cannot be read on reload', async () => {
    const originalGetItem = Storage.prototype.getItem;
    const storageFailure = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (this: Storage, key) {
      if (this === localStorage && key === POS_LAST_ACTIVITY_STORAGE_KEY) {
        throw new DOMException('Denied', 'SecurityError');
      }
      return originalGetItem.call(this, key);
    });
    try {
      await renderProvider();
      await act(async () => {
        await Promise.resolve();
      });
      expect(repositoryMocks.lockSession).toHaveBeenCalledOnce();
      expect(screen.getByTestId('state').textContent).toBe('LOCKED');
    } finally {
      storageFailure.mockRestore();
    }
  });

  it('accepts real activity from another tab but a cross-tab session_locked signal locks every tab', async () => {
    vi.useFakeTimers();
    const startedAt = Date.parse('2026-08-17T06:00:00.000Z');
    vi.setSystemTime(startedAt);
    persistPosLastActivityAt(startedAt);
    await renderProvider();

    vi.setSystemTime(startedAt + POS_IDLE_LOCK_MS - 60_000);
    const crossTabActivityAt = Date.now();
    persistPosLastActivityAt(crossTabActivityAt);
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: POS_LAST_ACTIVITY_STORAGE_KEY,
        newValue: JSON.stringify({ version: 1, at: crossTabActivityAt }),
        storageArea: localStorage,
      }),
    );
    await act(async () => {
      vi.advanceTimersByTime(60_000);
      await Promise.resolve();
    });
    expect(repositoryMocks.lockSession).not.toHaveBeenCalled();

    const lockedAt = new Date(Date.now()).toISOString();
    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: POS_SESSION_LOCK_STORAGE_KEY,
          newValue: JSON.stringify({ type: 'session_locked', lockedAt, eventId: 'other-tab-lock-1' }),
          storageArea: localStorage,
        }),
      );
    });

    expect(screen.getByTestId('state').textContent).toBe('LOCKED');
    expect(screen.getByTestId('token').textContent).toBe('original-token');
    expect(JSON.parse(sessionStorage.getItem('restaurant-pos-session') ?? '{}')).toMatchObject({
      token: 'original-token',
      lockedAt,
    });
  });

  it('revokes the employee session on Change User while preserving the paired device', async () => {
    await renderProvider();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'change' }));
      await Promise.resolve();
    });

    expect(repositoryMocks.logoutSession).toHaveBeenCalledOnce();
    expect(screen.getByTestId('state').textContent).toBe('PAIRED_NO_USER');
    expect(screen.getByTestId('token').textContent).toBe('none');
    expect(screen.getByTestId('restaurant').textContent).toBe('restaurant-1');
  });

  it('moves immediately to REVOKED when the API reports device revocation', async () => {
    await renderProvider();

    act(() => {
      window.dispatchEvent(new CustomEvent('postcode:device-security-state', { detail: 'device_revoked' }));
    });

    expect(screen.getByTestId('state').textContent).toBe('REVOKED');
    expect(screen.getByTestId('token').textContent).toBe('none');
  });

  it('silently recovers an expired lease with the same paired device key', async () => {
    await renderProvider();

    await act(async () => {
      window.dispatchEvent(new CustomEvent('postcode:device-security-state', { detail: 'device_lease_expired' }));
      await Promise.resolve();
    });

    expect(screen.getByTestId('state').textContent).toBe('AUTHENTICATED');
    expect(screen.getByTestId('token').textContent).toBe('original-token');
    expect(repositoryMocks.restoreDeviceBinding).toHaveBeenCalledTimes(2);
  });
});
