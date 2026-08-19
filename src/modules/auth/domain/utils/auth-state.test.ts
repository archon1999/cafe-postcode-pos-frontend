import { describe, expect, it } from 'vitest';

import type { PosAuthState, PosDevicePairing, PosSessionPayload } from '../entities';

import { derivePosAuthState, transitionPosAuthState, type PosAuthStateEvent } from './auth-state';

const session = (locked = false): PosSessionPayload => ({
  token: 'session-token',
  user: { id: 'user-1', username: 'cashier', fullName: 'Cashier', permissionCodes: [] },
  ...(locked ? { lockedAt: '2026-08-16T12:00:00.000Z' } : {}),
});

const pairing: PosDevicePairing = {
  id: 'pairing-1',
  pollToken: 'poll',
  claimToken: 'claim',
  displayCode: '123456',
  expiresAt: '2026-08-16T12:05:00.000Z',
  status: 'PENDING',
};

describe('POS authentication state machine', () => {
  it.each([
    [null, 'PAIRED_NO_USER'],
    [session(), 'AUTHENTICATED'],
    [session(true), 'LOCKED'],
  ] as const)('derives the paired state from the employee session', (value, expected) => {
    expect(derivePosAuthState(value)).toBe(expected);
  });

  it.each<[PosAuthState, PosAuthStateEvent, PosAuthState]>([
    ['UNPAIRED', { type: 'PAIRING_STARTED' }, 'PAIRING'],
    ['UNPAIRED', { type: 'PAIRING_RESTORED', pairing }, 'PAIRING'],
    ['PAIRING', { type: 'DEVICE_PAIRED', session: null }, 'PAIRED_NO_USER'],
    ['PAIRING', { type: 'DEVICE_PAIRED', session: session() }, 'AUTHENTICATED'],
    ['AUTHENTICATED', { type: 'SESSION_LOCKED' }, 'LOCKED'],
    ['LOCKED', { type: 'USER_AUTHENTICATED' }, 'AUTHENTICATED'],
    ['LOCKED', { type: 'USER_CHANGED' }, 'PAIRED_NO_USER'],
    ['AUTHENTICATED', { type: 'USER_CHANGED' }, 'PAIRED_NO_USER'],
    ['AUTHENTICATED', { type: 'DEVICE_REVOKED' }, 'REVOKED'],
    ['LOCKED', { type: 'DEVICE_REVOKED' }, 'REVOKED'],
    ['REVOKED', { type: 'DEVICE_FORGOTTEN' }, 'UNPAIRED'],
  ])('%s + %s -> %s', (current, event, expected) => {
    expect(transitionPosAuthState(current, event)).toBe(expected);
  });

  it('does not let a lock event manufacture a locked session before authentication', () => {
    expect(transitionPosAuthState('PAIRED_NO_USER', { type: 'SESSION_LOCKED' })).toBe('PAIRED_NO_USER');
  });
});
