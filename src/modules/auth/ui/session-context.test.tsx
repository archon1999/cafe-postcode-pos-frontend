// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PosAuthApiError } from '../data-access/repository/auth.repository.impl';
import { POS_SESSION_LOCK_STORAGE_KEY } from '../data-access/storage/session-security';
import type { PosDeviceBinding } from '../domain';

import { PosSessionProvider, usePosSession } from './session-context';

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

  it('routes an existing server-locked session to PIN unlock instead of device revocation', async () => {
    sessionStorage.setItem(
      'restaurant-pos-session',
      JSON.stringify({
        token: 'original-token',
        lockedAt: '2026-08-21T04:00:00.000Z',
        user: { id: 'user-1', username: 'cashier', fullName: 'Cashier', permissionCodes: [] },
        restaurantContext: binding.restaurantContext,
      }),
    );
    repositoryMocks.restoreDeviceBinding.mockRejectedValueOnce(
      new PosAuthApiError('POS session is locked.', 'session_locked', 423),
    );

    await renderProvider();

    expect(screen.getByTestId('state').textContent).toBe('LOCKED');
    expect(screen.getByTestId('state').textContent).not.toBe('REVOKED');
    expect(screen.getByTestId('restaurant').textContent).toBe('restaurant-1');
  });

  it.each([
    ['backend deployment outage', new Error('Network Error')],
    ['identical request replay', new PosAuthApiError('Device proof was already used.', 'device_replay_detected', 401)],
    ['rolling lease expiry', new PosAuthApiError('Device lease expired.', 'device_lease_expired', 401)],
  ])('keeps the stored device and local session during %s', async (_label, restoreError) => {
    readIdentityMock.mockResolvedValue({
      device: binding.device,
      restaurantContext: binding.restaurantContext,
    });
    repositoryMocks.restoreDeviceBinding.mockRejectedValueOnce(restoreError);

    await renderProvider();

    expect(screen.getByTestId('state').textContent).toBe('AUTHENTICATED');
    expect(screen.getByTestId('token').textContent).toBe('original-token');
    expect(screen.getByTestId('restaurant').textContent).toBe('restaurant-1');
  });

  it('never locks automatically after inactivity, browser suspension, focus, or input', async () => {
    vi.useFakeTimers();
    await renderProvider();
    const now = Date.now();
    vi.setSystemTime(now + 24 * 60 * 60_000);
    await act(async () => {
      vi.advanceTimersByTime(24 * 60 * 60_000);
      fireEvent.pointerMove(window);
      fireEvent.pointerDown(window);
      fireEvent.keyDown(window, { key: 'Enter' });
      window.dispatchEvent(new Event('focus'));
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();
    });

    expect(repositoryMocks.lockSession).not.toHaveBeenCalled();
    expect(screen.getByTestId('state').textContent).toBe('AUTHENTICATED');
  });

  it('keeps explicit manual lock and rotated PIN unlock', async () => {
    await renderProvider();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'lock' }));
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

  it('accepts a cross-tab session_locked signal and locks every tab', async () => {
    await renderProvider();

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
    expect(JSON.parse(localStorage.getItem('restaurant-pos-session') ?? '{}')).toMatchObject({
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
