// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { kitchenRepository, persistTvMonitorDevice, readTvMonitorDevice } from 'modules/kitchen/data-access';

import { TvMonitorPage } from './TvMonitorPage';

vi.mock('qrcode', () => ({ default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,qr') } }));
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

describe('TvMonitorPage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete window.CafePostcodeTv;
    audioInstances.length = 0;
    vi.stubGlobal('Audio', MockAudio);
    vi.spyOn(kitchenRepository, 'reportTvMonitorDiagnostic').mockResolvedValue();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('stores the device permanently after the manager claims the QR pairing', async () => {
    const onQueueSuccess = vi.fn();
    window.CafePostcodeTv = { onQueueSuccess };
    vi.spyOn(kitchenRepository, 'createTvMonitorPairing').mockResolvedValue({
      id: 'pairing-1',
      pollToken: 'device-token',
      claimToken: 'claim-token',
      expiresAt: '2099-01-01T00:00:00Z',
    });
    vi.spyOn(kitchenRepository, 'getTvMonitorPairingStatus').mockResolvedValue({
      status: 'paired',
      restaurantContext: {
        restaurantId: 'restaurant-1',
        restaurantName: 'Qamish',
        posMonitorVariant: 'light_compact',
      },
    });
    vi.spyOn(kitchenRepository, 'getTvMonitorQueue').mockResolvedValue({
      monitorVariant: 'light_compact',
      preparing: [],
      recentlyDone: [],
    });

    render(<TvMonitorPage />);

    expect((await screen.findByTestId('paired-monitor')).textContent).toBe('Qamish');
    await waitFor(() =>
      expect(readTvMonitorDevice()).toEqual({
        token: 'device-token',
        restaurantId: 'restaurant-1',
        restaurantName: 'Qamish',
        posMonitorVariant: 'light_compact',
      }),
    );
    expect(kitchenRepository.getTvMonitorQueue).toHaveBeenCalledWith('device-token');
    expect(onQueueSuccess).toHaveBeenCalled();
    expect((await screen.findByTestId('tv-monitor-diagnostics')).textContent).toContain('ONLINE');
    await waitFor(() =>
      expect(kitchenRepository.reportTvMonitorDiagnostic).toHaveBeenCalledWith(
        'device-token',
        expect.objectContaining({ event: 'queue_success' }),
      ),
    );
  });

  it('unlocks browser audio with one explicit TV interaction', async () => {
    persistTvMonitorDevice({
      token: 'browser-device-token',
      restaurantId: 'restaurant-1',
      restaurantName: 'New York',
      posMonitorVariant: 'default',
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
        'browser-device-token',
        expect.objectContaining({ event: 'announcement_play_ended' }),
      ),
    );

    fireEvent.click(screen.getByTestId('simulate-audio-failure'));

    expect(screen.getByTestId('tv-audio-unlock-overlay')).toBeTruthy();
    expect(screen.getByTestId('tv-audio-unlock-error').textContent).toContain('Ovoz to‘xtadi');
  });
});
