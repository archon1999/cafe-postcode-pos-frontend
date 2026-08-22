// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { kitchenRepository } from 'modules/kitchen/data-access';

import { TvMonitorPage } from './TvMonitorPage';

vi.mock('./KitchenMonitorPage', () => ({
  KitchenMonitorDisplay: ({
    restaurantName,
    announcementPlaybackEnabled,
    onAnnouncementPlaybackUnavailable,
  }: {
    restaurantName?: string;
    announcementPlaybackEnabled?: boolean;
    onAnnouncementPlaybackUnavailable?: (message: string) => void;
  }) => (
    <>
      <div data-testid="paired-monitor" data-audio-enabled={announcementPlaybackEnabled ? 'true' : 'false'}>
        {restaurantName}
      </div>
      <button
        type="button"
        data-testid="simulate-audio-failure"
        onClick={() => onAnnouncementPlaybackUnavailable?.('blocked')}>
        fail
      </button>
    </>
  ),
}));

const audioInstances: MockAudio[] = [];

class MockAudio extends EventTarget {
  src = '';
  currentTime = 0;
  preload = '';
  pause = vi.fn();
  load = vi.fn();
  play = vi.fn().mockResolvedValue(undefined);

  constructor() {
    super();
    audioInstances.push(this);
  }
}

const activeDevice = {
  id: 'device-1',
  type: 'TV_MONITOR' as const,
  name: 'Kitchen TV',
  status: 'ACTIVE' as const,
  leaseExpiresAt: '2099-01-01T00:00:00Z',
};

describe('TvMonitorPage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete window.CafePostcodeTv;
    audioInstances.length = 0;
    vi.stubGlobal('Audio', MockAudio);
    vi.spyOn(kitchenRepository, 'bootstrapTvMonitor').mockResolvedValue({ status: 'unpaired' });
    vi.spyOn(kitchenRepository, 'forgetTvMonitorDevice').mockResolvedValue();
    vi.spyOn(kitchenRepository, 'reportTvMonitorDiagnostic').mockResolvedValue();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('uses the backend fragment QR and starts signed queue polling after approval', async () => {
    const onQueueSuccess = vi.fn();
    window.CafePostcodeTv = { onQueueSuccess };
    const claimUrl =
      'https://control.cafe-postcode.uz/pair#v=1&pairingId=pairing-1&claimToken=one-time-claim';
    vi.spyOn(kitchenRepository, 'createTvMonitorPairing').mockResolvedValue({
      id: 'pairing-1',
      pollToken: 'poll-secret',
      claimUrl,
      qrPath: 'M4 4h1v1h-1zM5 5h1v1h-1z',
      qrSize: 29,
      displayCode: '482913',
      expiresAt: '2099-01-01T00:00:00Z',
      status: 'pending',
    });
    let resolvePairingStatus!: (value: Awaited<ReturnType<typeof kitchenRepository.getTvMonitorPairingStatus>>) => void;
    vi.spyOn(kitchenRepository, 'getTvMonitorPairingStatus').mockReturnValue(
      new Promise((resolve) => {
        resolvePairingStatus = resolve;
      }),
    );
    vi.spyOn(kitchenRepository, 'getTvMonitorQueue').mockResolvedValue({
      announcements: [],
      monitorVariant: 'light_compact',
      preparing: [],
      recentlyDone: [],
    });

    render(<TvMonitorPage />);

    const qr = await screen.findByLabelText('TV pairing QR code');
    expect(qr.querySelector('path')?.getAttribute('d')).toContain('M4 4h1v1h-1z');
    await act(async () => {
      resolvePairingStatus({
        status: 'paired',
        device: activeDevice,
        restaurantContext: {
          restaurantId: 'restaurant-1',
          restaurantName: 'Qamish',
          posMonitorVariant: 'light_compact',
        },
      });
    });
    expect((await screen.findByTestId('paired-monitor')).textContent).toBe('Qamish');
    expect(kitchenRepository.getTvMonitorPairingStatus).toHaveBeenCalledWith('pairing-1', 'poll-secret');
    await waitFor(() => expect(kitchenRepository.getTvMonitorQueue).toHaveBeenCalledWith());
    await waitFor(() => expect(onQueueSuccess).toHaveBeenCalled());
    await waitFor(() =>
      expect(kitchenRepository.reportTvMonitorDiagnostic).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'queue_success' }),
      ),
    );
  });

  it('keeps the paired TV visible when browser audio is unavailable', async () => {
    vi.mocked(kitchenRepository.bootstrapTvMonitor).mockResolvedValue({
      status: 'paired',
      device: {
        deviceId: activeDevice.id,
        deviceStatus: activeDevice.status,
        leaseExpiresAt: activeDevice.leaseExpiresAt,
        restaurantId: 'restaurant-1',
        restaurantName: 'New York',
        posMonitorVariant: 'default',
      },
    });
    vi.spyOn(kitchenRepository, 'getTvMonitorQueue').mockResolvedValue({
      monitorVariant: 'default',
      preparing: [],
      recentlyDone: [],
      announcements: [],
    });

    render(<TvMonitorPage />);

    expect(await screen.findByTestId('paired-monitor')).toBeTruthy();
    expect(screen.queryByTestId('tv-audio-unlock-overlay')).toBeNull();
    expect(screen.getByTestId('paired-monitor').getAttribute('data-audio-enabled')).toBe('true');

    fireEvent.click(screen.getByTestId('simulate-audio-failure'));

    expect(screen.queryByTestId('tv-audio-unlock-overlay')).toBeNull();
    expect(screen.getByTestId('paired-monitor')).toBeTruthy();
  });

  it('keeps a paired TV identity when a lease renewal is temporarily delayed', async () => {
    vi.mocked(kitchenRepository.bootstrapTvMonitor).mockResolvedValue({
      status: 'paired',
      device: {
        deviceId: activeDevice.id,
        deviceStatus: activeDevice.status,
        leaseExpiresAt: activeDevice.leaseExpiresAt,
        restaurantId: 'restaurant-1',
        restaurantName: 'New York',
        posMonitorVariant: 'default',
      },
    });
    vi.spyOn(kitchenRepository, 'getTvMonitorQueue').mockRejectedValue(
      Object.assign(new Error('lease renewal delayed'), {
        isAxiosError: true,
        response: { status: 401, data: { code: 'device_lease_expired' } },
      }),
    );

    render(<TvMonitorPage />);

    await waitFor(() => expect(kitchenRepository.getTvMonitorQueue).toHaveBeenCalled());
    expect(kitchenRepository.forgetTvMonitorDevice).not.toHaveBeenCalled();
    expect(screen.getByTestId('paired-monitor').textContent).toContain('New York');
  });
});
