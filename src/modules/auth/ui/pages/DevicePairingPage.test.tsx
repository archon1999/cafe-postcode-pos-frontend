// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DevicePairingPage } from './DevicePairingPage';

const contextMock = vi.hoisted(() => vi.fn());
const qrMock = vi.hoisted(() => vi.fn().mockResolvedValue('data:image/png;base64,qr'));

vi.mock('../session-context', () => ({ usePosSession: () => contextMock() }));
vi.mock('qrcode', () => ({ default: { toDataURL: (...args: unknown[]) => qrMock(...args) } }));
vi.mock('shared/ui/PosLogo', () => ({ PosLogo: () => <div aria-hidden="true" /> }));

describe('DevicePairingPage', () => {
  afterEach(() => {
    cleanup();
    contextMock.mockReset();
    qrMock.mockClear();
  });

  it('puts only the one-use claim token in the control-app QR and keeps poll token private', async () => {
    contextMock.mockReturnValue({
      authState: 'PAIRING',
      deviceError: null,
      pairing: {
        id: '11111111-1111-4111-8111-111111111111',
        pollToken: 'private-poll-secret',
        claimToken: 'one-use-claim-secret',
        displayCode: '482193',
        expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
        status: 'PENDING',
      },
      cancelPairing: vi.fn(),
      refreshPairing: vi.fn().mockResolvedValue(undefined),
      startPairing: vi.fn(),
    });

    render(<DevicePairingPage />);

    await waitFor(() => expect(qrMock).toHaveBeenCalled());
    const qrValue = String(qrMock.mock.calls[0][0]);
    expect(qrValue).toBe(
      'https://control.cafe-postcode.uz/pair#v=1&pairingId=11111111-1111-4111-8111-111111111111&claimToken=one-use-claim-secret',
    );
    expect(qrValue).not.toContain('private-poll-secret');
    expect(screen.getByText('482193')).toBeTruthy();
  });

  it('automatically replaces an expired pairing request', async () => {
    const cancelPairing = vi.fn().mockResolvedValue(undefined);
    const startPairing = vi.fn().mockResolvedValue(undefined);
    contextMock.mockReturnValue({
      authState: 'PAIRING',
      deviceError: null,
      pairing: {
        id: '22222222-2222-4222-8222-222222222222',
        pollToken: 'private-poll-secret',
        claimToken: 'expired-claim-secret',
        displayCode: '123456',
        expiresAt: new Date(Date.now() - 1_000).toISOString(),
        status: 'PENDING',
      },
      cancelPairing,
      refreshPairing: vi.fn().mockResolvedValue(undefined),
      startPairing,
    });

    render(<DevicePairingPage />);

    await waitFor(() => expect(cancelPairing).toHaveBeenCalledTimes(1));
    expect(startPairing).toHaveBeenCalledTimes(1);
  });

  it('automatically replaces a pairing that the status endpoint marks expired', async () => {
    const cancelPairing = vi.fn().mockResolvedValue(undefined);
    const startPairing = vi.fn().mockResolvedValue(undefined);
    contextMock.mockReturnValue({
      authState: 'PAIRING',
      deviceError: 'Ulash so‘rovi yakunlanmadi.',
      pairing: {
        id: '33333333-3333-4333-8333-333333333333',
        pollToken: 'private-poll-secret',
        claimToken: 'expired-claim-secret',
        displayCode: '654321',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        status: 'EXPIRED',
      },
      cancelPairing,
      refreshPairing: vi.fn().mockResolvedValue(undefined),
      startPairing,
    });

    render(<DevicePairingPage />);

    await waitFor(() => expect(cancelPairing).toHaveBeenCalledTimes(1));
    expect(startPairing).toHaveBeenCalledTimes(1);
  });
});
