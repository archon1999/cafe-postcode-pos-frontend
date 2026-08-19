import type { PosAuthState, PosDevicePairing, PosSessionPayload } from '../entities';

export type PosAuthStateEvent =
  | { type: 'NO_DEVICE' }
  | { type: 'PAIRING_STARTED' }
  | { type: 'PAIRING_RESTORED'; pairing: PosDevicePairing }
  | { type: 'DEVICE_PAIRED'; session: PosSessionPayload | null }
  | { type: 'USER_AUTHENTICATED' }
  | { type: 'SESSION_LOCKED' }
  | { type: 'USER_CHANGED' }
  | { type: 'DEVICE_REVOKED' }
  | { type: 'DEVICE_FORGOTTEN' };

export function derivePosAuthState(session: PosSessionPayload | null): PosAuthState {
  if (!session?.token) return 'PAIRED_NO_USER';
  return session.lockedAt ? 'LOCKED' : 'AUTHENTICATED';
}

export function transitionPosAuthState(current: PosAuthState, event: PosAuthStateEvent): PosAuthState {
  switch (event.type) {
    case 'NO_DEVICE':
    case 'DEVICE_FORGOTTEN':
      return 'UNPAIRED';
    case 'PAIRING_STARTED':
    case 'PAIRING_RESTORED':
      return 'PAIRING';
    case 'DEVICE_PAIRED':
      return derivePosAuthState(event.session);
    case 'USER_AUTHENTICATED':
      return 'AUTHENTICATED';
    case 'SESSION_LOCKED':
      return current === 'AUTHENTICATED' ? 'LOCKED' : current;
    case 'USER_CHANGED':
      return current === 'LOCKED' || current === 'AUTHENTICATED' ? 'PAIRED_NO_USER' : current;
    case 'DEVICE_REVOKED':
      return 'REVOKED';
  }
}
