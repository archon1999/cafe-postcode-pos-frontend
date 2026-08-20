// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import QRCode from 'qrcode';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { kitchenRepository } from 'modules/kitchen/data-access';

import { TvMonitorPage } from './TvMonitorPage';

vi.mock('qrcode', () => ({ default: { toString: vi.fn().mockResolvedValue('<svg><path /></svg>') } }));
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
    const claimUrl = 'https://admin.cafe-postcode.uz/pair#v=1&pairingId=pairing-1&claimToken=one-time-claim';
    vi.spyOn(kitchenRepository, 'createTvMonitorPairing').mockResolvedValue({
      id: 'pairing-1',
      pollToken: 'poll-secret',
      claimUrl,
      displayCode: '482913',
      expiresAt: '2099-01-01T00:00:00Z',
      status: 'pending',
    });
    vi.spyOn(kitchenRepository, 'getTvMonitorPairingStatus').mockResolvedValue({
      status: 'paired',
      device: activeDevice,
      restaurantContext: {
        restaurantId: 'restaurant-1',
        restaurantName: 'Qamish',
        posMonitorVariant: 'light_compact',
      },
    });
    vi.spyOn(kitchenRepository, 'getTvMonitorQueue').mockResolvedValue({
      announcements: [],
      monitorVariant: 'light_compact',
      preparing: [],
      recentlyDone: [],
    });

    render(<TvMonitorPage />);

    expect((await screen.findByTestId('paired-monitor')).textContent).toBe('Qamish');
    expect(QRCode.toString).toHaveBeenCalledWith(
      claimUrl,
      expect.objectContaining({ type: 'svg', errorCorrectionLevel: 'M' }),
    );
    expect(kitchenRepository.getTvMonitorPairingStatus).toHaveBeenCalledWith('pairing-1', 'poll-secret');
    await waitFor(() => expect(kitchenRepository.getTvMonitorQueue).toHaveBeenCalledWith());
    await waitFor(() => expect(onQueueSuccess).toHaveBeenCalled());
    expect((await screen.findByTestId('tv-monitor-diagnostics')).textContent).toContain('ONLINE');
    await waitFor(() =>
      expect(kitchenRepository.reportTvMonitorDiagnostic).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'queue_success' }),
      ),
    );
  });

  it('restores an already paired device and unlocks browser audio with one interaction', async () => {
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

    expect(await screen.findByTestId('tv-audio-unlock-overlay')).toBeTruthy();
    expect(screen.getByTestId('paired-monitor').getAttribute('data-audio-enabled')).toBe('false');

    fireEvent.click(screen.getByTestId('tv-audio-unlock-button'));

    expect(audioInstances).toHaveLength(1);
    expect(audioInstances[0].src).toContain('/monitor-announcements/v1/uz/female/unlock.mp3');
    expect(audioInstances[0].load).toHaveBeenCalledTimes(1);
    expect(audioInstances[0].play).toHaveBeenCalledTimes(1);

    await act(async () => audioInstances[0].dispatchEvent(new Event('ended')));

    expect(screen.queryByTestId('tv-audio-unlock-overlay')).toBeNull();
    expect(screen.getByTestId('paired-monitor').getAttribute('data-audio-enabled')).toBe('true');
    await waitFor(() =>
      expect(kitchenRepository.reportTvMonitorDiagnostic).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'announcement_play_ended' }),
      ),
    );

    fireEvent.click(screen.getByTestId('simulate-audio-failure'));

    expect(screen.getByTestId('tv-audio-unlock-overlay')).toBeTruthy();
    expect(screen.getByTestId('tv-audio-unlock-error').textContent).toContain('Ovoz to‘xtadi');
  });
});
