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
      'https://admin.cafe-postcode.uz/pair#v=1&pairingId=11111111-1111-4111-8111-111111111111&claimToken=one-use-claim-secret',
    );
    expect(qrValue).not.toContain('private-poll-secret');
    expect(screen.getByText('482193')).toBeTruthy();
  });
});
