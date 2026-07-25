// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { kitchenRepository, readTvMonitorDevice } from 'modules/kitchen/data-access';

import { TvMonitorPage } from './TvMonitorPage';

vi.mock('qrcode', () => ({ default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,qr') } }));
vi.mock('./KitchenMonitorPage', () => ({
  KitchenMonitorDisplay: ({ restaurantName }: { restaurantName?: string }) => (
    <div data-testid="paired-monitor">{restaurantName}</div>
  ),
}));

describe('TvMonitorPage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete window.CafePostcodeTv;
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
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
      restaurantContext: { restaurantId: 'restaurant-1', restaurantName: 'Qamish' },
    });
    vi.spyOn(kitchenRepository, 'getTvMonitorQueue').mockResolvedValue({ preparing: [], recentlyDone: [] });

    render(<TvMonitorPage />);

    expect((await screen.findByTestId('paired-monitor')).textContent).toBe('Qamish');
    await waitFor(() =>
      expect(readTvMonitorDevice()).toEqual({
        token: 'device-token',
        restaurantId: 'restaurant-1',
        restaurantName: 'Qamish',
      }),
    );
    expect(kitchenRepository.getTvMonitorQueue).toHaveBeenCalledWith('device-token');
    expect(onQueueSuccess).toHaveBeenCalled();
  });
});
