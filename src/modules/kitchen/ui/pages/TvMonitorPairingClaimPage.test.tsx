// @vitest-environment jsdom

import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { kitchenRepository } from 'modules/kitchen/data-access';

import { TvMonitorPairingClaimPage } from './TvMonitorPairingClaimPage';

vi.mock('modules/auth', () => ({
  usePosSession: () => ({ setSession: vi.fn() }),
}));

describe('TvMonitorPairingClaimPage', () => {
  afterEach(() => vi.restoreAllMocks());

  it('claims the TV automatically with the authenticated employee session', async () => {
    const claim = vi
      .spyOn(kitchenRepository, 'claimTvMonitorPairing')
      .mockResolvedValue({ status: 'paired', restaurantName: 'Qamish' });

    render(
      <MemoryRouter initialEntries={['/tv/pair/pairing-1?token=claim-token']}>
        <Routes>
          <Route path="/tv/pair/:pairingId" element={<TvMonitorPairingClaimPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(claim).toHaveBeenCalledWith('pairing-1', 'claim-token'));
    expect(await screen.findByText('TV ulandi')).toBeTruthy();
    expect(screen.getByText(/Qamish monitori tayyor/)).toBeTruthy();
  });
});
