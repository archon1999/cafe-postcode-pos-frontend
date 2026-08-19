export const POS_DEVICE_SECURITY_EVENT = 'postcode:device-security-state';

export type PosDeviceSecurityCode =
  | 'device_required'
  | 'device_revoked'
  | 'device_lease_expired'
  | 'device_proof_invalid'
  | 'device_replay_detected';

export function isPosDeviceSecurityCode(value: unknown): value is PosDeviceSecurityCode {
  return (
    typeof value === 'string' &&
    [
      'device_required',
      'device_revoked',
      'device_lease_expired',
      'device_proof_invalid',
      'device_replay_detected',
    ].includes(value)
  );
}

export function dispatchPosDeviceSecurityEvent(code: PosDeviceSecurityCode) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<PosDeviceSecurityCode>(POS_DEVICE_SECURITY_EVENT, { detail: code }));
  }
}
