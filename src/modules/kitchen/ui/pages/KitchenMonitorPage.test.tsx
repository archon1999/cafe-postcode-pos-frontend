// @vitest-environment jsdom

import { act, render, screen } from '@testing-library/react';
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
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('renders preparing and ready order numbers', () => {
    useKitchenMonitorQueryMock.mockReturnValue({
      data: {
        preparing: [{ id: 'prep-1', orderNumber: 214, status: 'new', completedAt: null }],
        recentlyDone: [{ id: 'done-1', orderNumber: 1205, status: 'done', completedAt: '2026-04-09T10:00:00Z' }],
      },
    });

    render(<KitchenMonitorPage />);

    expect(screen.getByText('Tayyorlanayapti')).toBeTruthy();
    expect(screen.getByText("Tayyor bo'lganlar")).toBeTruthy();
    expect(screen.getByText('A00214')).toBeTruthy();
    expect(screen.getByText('A01205')).toBeTruthy();
  });

  it('animates and plays a single sound when a new ready order appears', async () => {
    useKitchenMonitorQueryMock
      .mockReturnValueOnce({
        data: {
          preparing: [],
          recentlyDone: [{ id: 'done-1', orderNumber: 1205, status: 'done', completedAt: '2026-04-09T10:00:00Z' }],
        },
      })
      .mockReturnValue({
        data: {
          preparing: [],
          recentlyDone: [
            { id: 'done-2', orderNumber: 1209, status: 'done', completedAt: '2026-04-09T10:00:10Z' },
            { id: 'done-1', orderNumber: 1205, status: 'done', completedAt: '2026-04-09T10:00:00Z' },
          ],
        },
      });

    const { rerender } = render(<KitchenMonitorPage />);

    expect(audioContextConstructor).not.toHaveBeenCalled();

    rerender(<KitchenMonitorPage />);

    await act(async () => {});

    expect(audioContextConstructor).toHaveBeenCalledTimes(1);

    const highlightedRow = screen.getByText('A01209').closest('[data-highlighted]');
    expect(highlightedRow?.getAttribute('data-highlighted')).toBe('true');

    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    expect(screen.getByText('A01209').closest('[data-highlighted]')?.getAttribute('data-highlighted')).toBe('false');
  });
});
