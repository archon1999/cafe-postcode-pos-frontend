// @vitest-environment jsdom

import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { KitchenMonitorPage } from './KitchenMonitorPage';

const useKitchenMonitorQueryMock = vi.fn();

vi.mock('modules/auth', () => ({
  usePosSession: () => ({
    restaurantContext: { restaurantId: 'restaurant-1' },
  }),
}));

vi.mock('modules/kitchen/application', () => ({
  useKitchenMonitorQuery: (...args: unknown[]) => useKitchenMonitorQueryMock(...args),
}));

class MockAudioContext {
  currentTime = 0;
  state: AudioContextState = 'running';
  destination = {};

  resume = vi.fn().mockResolvedValue(undefined);
  close = vi.fn().mockResolvedValue(undefined);

  createOscillator() {
    return {
      type: 'sine',
      frequency: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
  }

  createGain() {
    return {
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    };
  }
}

describe('KitchenMonitorPage', () => {
  const audioContextConstructor = vi.fn(() => new MockAudioContext());

  beforeEach(() => {
    vi.useFakeTimers();
    useKitchenMonitorQueryMock.mockReset();
    audioContextConstructor.mockClear();
    vi.stubGlobal('AudioContext', audioContextConstructor);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('renders preparing and ready order numbers', () => {
    useKitchenMonitorQueryMock.mockReturnValue({
      data: {
        preparing: [{ id: 'prep-1', orderNumber: 214, displayName: '14', status: 'new', completedAt: null }],
        recentlyDone: [
          { id: 'done-1', orderNumber: 1205, displayName: '15', status: 'done', completedAt: '2026-04-09T10:00:00Z' },
        ],
      },
    });

    render(<KitchenMonitorPage />);

    expect(screen.getByText('Tayyorlanayapti')).toBeTruthy();
    expect(screen.getByText("Tayyor bo'lganlar")).toBeTruthy();
    expect(screen.getByText('#14')).toBeTruthy();
    expect(screen.getByText('#15')).toBeTruthy();
    expect(screen.queryByTestId('ready-order-spotlight')).toBeNull();
    expect(audioContextConstructor).not.toHaveBeenCalled();
  });

  it('shows a centered spotlight and plays a single sound when a new ready order appears', async () => {
    useKitchenMonitorQueryMock
      .mockReturnValueOnce({
        data: {
          preparing: [],
          recentlyDone: [
            { id: 'done-1', orderNumber: 1205, displayName: '15', status: 'done', completedAt: '2026-04-09T10:00:00Z' },
          ],
        },
      })
      .mockReturnValue({
        data: {
          preparing: [],
          recentlyDone: [
            { id: 'done-2', orderNumber: 1209, displayName: '19', status: 'done', completedAt: '2026-04-09T10:00:10Z' },
            { id: 'done-1', orderNumber: 1205, displayName: '15', status: 'done', completedAt: '2026-04-09T10:00:00Z' },
          ],
        },
      });

    const { rerender } = render(<KitchenMonitorPage />);

    expect(audioContextConstructor).not.toHaveBeenCalled();

    rerender(<KitchenMonitorPage />);

    await act(async () => {});

    expect(audioContextConstructor).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('ready-order-spotlight')).toBeTruthy();
    expect(screen.getAllByText('#19')).toHaveLength(2);

    const highlightedRow = screen
      .getAllByText('#19')
      .map((node) => node.closest('[data-highlighted]'))
      .find(Boolean);
    expect(highlightedRow?.getAttribute('data-highlighted')).toBe('true');

    await act(async () => {
      vi.advanceTimersByTime(2300);
    });

    expect(screen.queryByTestId('ready-order-spotlight')).toBeNull();
    expect(screen.getByText('#19').closest('[data-highlighted]')?.getAttribute('data-highlighted')).toBe('false');
  });

  it('highlights all new ready rows but spotlights only the newest ticket in one update', async () => {
    useKitchenMonitorQueryMock
      .mockReturnValueOnce({
        data: {
          preparing: [],
          recentlyDone: [
            { id: 'done-1', orderNumber: 1205, displayName: '15', status: 'done', completedAt: '2026-04-09T10:00:00Z' },
          ],
        },
      })
      .mockReturnValue({
        data: {
          preparing: [],
          recentlyDone: [
            { id: 'done-3', orderNumber: 1210, displayName: '20', status: 'done', completedAt: '2026-04-09T10:00:20Z' },
            { id: 'done-2', orderNumber: 1209, displayName: '19', status: 'done', completedAt: '2026-04-09T10:00:10Z' },
            { id: 'done-1', orderNumber: 1205, displayName: '15', status: 'done', completedAt: '2026-04-09T10:00:00Z' },
          ],
        },
      });

    const { rerender } = render(<KitchenMonitorPage />);

    rerender(<KitchenMonitorPage />);

    await act(async () => {});

    expect(audioContextConstructor).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('ready-order-spotlight').textContent).toContain('#20');
    expect(screen.getAllByText('#20')).toHaveLength(2);
    expect(screen.getAllByText('#19')).toHaveLength(1);

    const highlightedOrderNumbers = ['#20', '#19'];
    highlightedOrderNumbers.forEach((orderNumber) => {
      const highlightedRow = screen
        .getAllByText(orderNumber)
        .map((node) => node.closest('[data-highlighted]'))
        .find(Boolean);

      expect(highlightedRow?.getAttribute('data-highlighted')).toBe('true');
    });
  });
});
