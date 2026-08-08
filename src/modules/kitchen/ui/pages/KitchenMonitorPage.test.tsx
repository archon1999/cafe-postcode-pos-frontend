// @vitest-environment jsdom

import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { KitchenMonitorDisplay, KitchenMonitorPage } from './KitchenMonitorPage';

const useKitchenMonitorQueryMock = vi.fn();

vi.mock('modules/auth', () => ({
  usePosSession: () => ({
    restaurantContext: { restaurantId: 'restaurant-1', restaurantName: 'Test Restaurant' },
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

const audioInstances: MockAudio[] = [];

class MockAudio extends EventTarget {
  currentTime = 0;
  preload = '';
  pause = vi.fn();
  load = vi.fn();
  play = vi.fn().mockResolvedValue(undefined);

  constructor(public src = '') {
    super();
    audioInstances.push(this);
  }
}

function resizeViewport(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
  window.dispatchEvent(new Event('resize'));
}

describe('KitchenMonitorPage', () => {
  const audioContextConstructor = vi.fn(() => new MockAudioContext());

  beforeEach(() => {
    vi.useFakeTimers();
    resizeViewport(1920, 1080);
    useKitchenMonitorQueryMock.mockReset();
    audioContextConstructor.mockClear();
    audioInstances.length = 0;
    vi.stubGlobal('AudioContext', audioContextConstructor);
    vi.stubGlobal('Audio', MockAudio);
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
    expect(screen.getByTestId('monitor-restaurant-name').textContent).toBe('Test Restaurant');
    expect(screen.getByTestId('monitor-clock')).toBeTruthy();
    expect(screen.getByText('14')).toBeTruthy();
    expect(screen.getByText('15')).toBeTruthy();
    expect(screen.queryByTestId('ready-order-spotlight')).toBeNull();
    expect(audioContextConstructor).not.toHaveBeenCalled();
  });

  it('queues announcements until the shared TV audio element is unlocked', async () => {
    const sharedAudio = new MockAudio();
    const baseQueue = {
      monitorVariant: 'default' as const,
      preparing: [],
      recentlyDone: [],
      announcements: [],
    };
    const { rerender } = render(
      <KitchenMonitorDisplay
        monitorData={baseQueue}
        announcementAudio={sharedAudio as unknown as HTMLAudioElement}
        announcementPlaybackEnabled={false}
      />,
    );

    rerender(
      <KitchenMonitorDisplay
        monitorData={{
          ...baseQueue,
          recentlyDone: [
            {
              id: 'done-128',
              orderId: 'order-128',
              orderNumber: 5128,
              displayName: '128',
              status: 'done',
              completedAt: '2026-08-08T06:00:00Z',
            },
          ],
          announcements: [
            {
              id: 'announcement-128',
              orderId: 'order-128',
              orderNumber: 5128,
              displayName: '128',
              locale: 'uz',
              kind: 'auto',
              createdAt: '2026-08-08T06:00:00Z',
            },
          ],
        }}
        announcementAudio={sharedAudio as unknown as HTMLAudioElement}
        announcementPlaybackEnabled={false}
      />,
    );
    await act(async () => {});

    expect(sharedAudio.play).not.toHaveBeenCalled();
    expect(screen.queryByTestId('ready-order-spotlight')).toBeNull();

    rerender(
      <KitchenMonitorDisplay
        monitorData={{
          ...baseQueue,
          recentlyDone: [
            {
              id: 'done-128',
              orderId: 'order-128',
              orderNumber: 5128,
              displayName: '128',
              status: 'done',
              completedAt: '2026-08-08T06:00:00Z',
            },
          ],
          announcements: [
            {
              id: 'announcement-128',
              orderId: 'order-128',
              orderNumber: 5128,
              displayName: '128',
              locale: 'uz',
              kind: 'auto',
              createdAt: '2026-08-08T06:00:00Z',
            },
          ],
        }}
        announcementAudio={sharedAudio as unknown as HTMLAudioElement}
        announcementPlaybackEnabled
      />,
    );
    await act(async () => {});

    expect(sharedAudio.src).toContain('/128.mp3');
    expect(sharedAudio.load).toHaveBeenCalledTimes(1);
    expect(sharedAudio.play).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('ready-order-spotlight')).toBeTruthy();
  });

  it('renders the selected light compact variant as a light two-column board', () => {
    useKitchenMonitorQueryMock.mockReturnValue({
      data: {
        monitorVariant: 'light_compact',
        preparing: [
          { id: 'prep-1', orderNumber: 214, displayName: '14', status: 'new', completedAt: null },
          { id: 'prep-2', orderNumber: 216, displayName: '16', status: 'new', completedAt: null },
        ],
        recentlyDone: [],
      },
    });

    const { container } = render(<KitchenMonitorPage />);

    expect(container.querySelector('[data-monitor-variant="light_compact"]')).toBeTruthy();
    expect(screen.getByTestId('monitor-canvas').getAttribute('data-layout')).toBe('scaled');
    expect(screen.getByTestId('monitor-canvas').getAttribute('data-scale-x')).toBe('1.0000');
    expect(screen.getByTestId('monitor-canvas').getAttribute('data-scale-y')).toBe('1.0000');
    expect(screen.queryByTestId('monitor-clock')).toBeNull();
    expect(screen.queryByTestId('monitor-restaurant-name')).toBeNull();
    expect(screen.getByRole('button', { name: 'To‘liq ekranga o‘tish' })).toBeTruthy();
    expect(screen.getByText('Tayyorlanayapti')).toBeTruthy();
    expect(screen.getByText("Tayyor bo'lganlar")).toBeTruthy();
    expect(screen.getByText('14')).toBeTruthy();
    expect(screen.getByText('16')).toBeTruthy();
    const preparingGrid = screen.getAllByTestId('compact-monitor-grid')[0];
    const firstPreparingTicket = container.querySelector('[data-monitor-ticket-id="prep-1"]');
    expect(preparingGrid.getAttribute('data-item-layout')).toBe('pair');
    expect(preparingGrid.getAttribute('data-number-font-size')).toBe('190');
    expect(getComputedStyle(preparingGrid).paddingLeft).toBe('56px');
    expect(getComputedStyle(firstPreparingTicket as Element).paddingLeft).toBe('16px');
    expect(screen.getAllByTestId('compact-monitor-grid')[1].getAttribute('data-item-layout')).toBe('empty');
    expect(screen.queryByTestId('compact-empty-mark')).toBeNull();

    act(() => resizeViewport(1280, 720));
    expect(screen.getByTestId('monitor-canvas').getAttribute('data-scale-x')).toBe('0.6667');
    expect(screen.getByTestId('monitor-canvas').getAttribute('data-scale-y')).toBe('0.6667');

    act(() => resizeViewport(1280, 650));
    expect(screen.getByTestId('monitor-canvas').getAttribute('data-scale-x')).toBe('0.6667');
    expect(screen.getByTestId('monitor-canvas').getAttribute('data-scale-y')).toBe('0.6019');
  });

  it.each([
    [1, '190'],
    [2, '190'],
    [3, '190'],
    [4, '190'],
    [5, '132'],
    [12, '132'],
  ])('uses the intended light compact font size for %i visible tickets', (ticketCount, expectedFontSize) => {
    useKitchenMonitorQueryMock.mockReturnValue({
      data: {
        monitorVariant: 'light_compact',
        preparing: Array.from({ length: ticketCount }, (_, index) => ({
          id: `prep-${index + 1}`,
          orderNumber: index + 1,
          displayName: String(index + 1),
          status: 'new',
          completedAt: null,
        })),
        recentlyDone: [],
      },
    });

    render(<KitchenMonitorPage />);

    expect(screen.getAllByTestId('compact-monitor-grid')[0].getAttribute('data-number-font-size')).toBe(
      expectedFontSize,
    );
  });

  it('fits the same 1920x1080 canvas to TV resolutions and keeps compact screens native', () => {
    useKitchenMonitorQueryMock.mockReturnValue({ data: { preparing: [], recentlyDone: [] } });

    render(<KitchenMonitorPage />);

    expect(screen.getByTestId('monitor-canvas').getAttribute('data-layout')).toBe('scaled');
    expect(screen.getByTestId('monitor-canvas').getAttribute('data-scale')).toBe('1.0000');

    act(() => resizeViewport(1280, 720));
    expect(screen.getByTestId('monitor-canvas').getAttribute('data-scale')).toBe('0.6667');

    act(() => resizeViewport(800, 600));
    expect(screen.getByTestId('monitor-canvas').getAttribute('data-layout')).toBe('scaled');
    expect(screen.getByTestId('monitor-canvas').getAttribute('data-scale')).toBe('0.4167');

    act(() => resizeViewport(600, 320));
    expect(screen.getByTestId('monitor-canvas').getAttribute('data-layout')).toBe('compact');
    expect(screen.getByTestId('monitor-canvas').getAttribute('data-scale')).toBe('1.0000');
  });

  it('shows six orders per page, rotates overflow, and leaves an empty ready column clean', async () => {
    useKitchenMonitorQueryMock.mockReturnValue({
      data: {
        preparing: Array.from({ length: 7 }, (_, index) => ({
          id: `prep-${index + 1}`,
          orderNumber: index + 1,
          displayName: String(index + 1),
          status: 'new',
          completedAt: null,
        })),
        recentlyDone: [],
      },
    });

    render(<KitchenMonitorPage />);

    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByText('6')).toBeTruthy();
    expect(screen.queryByText('7')).toBeNull();
    expect(screen.getByText('1 / 2')).toBeTruthy();
    expect(screen.queryByText('Hozircha tayyor buyurtmalar yo‘q')).toBeNull();
    expect(screen.queryByText('Yangi buyurtmalar kutilmoqda')).toBeNull();
    expect(screen.getByTestId('monitor-empty-visual')).toBeTruthy();

    await act(async () => {
      vi.advanceTimersByTime(8000);
    });

    expect(screen.queryByText('1')).toBeNull();
    expect(screen.getByText('7')).toBeTruthy();
    expect(screen.getByText('2 / 2')).toBeTruthy();
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

    expect(audioInstances).toHaveLength(1);
    expect(audioInstances[0].src).toContain('/19.mp3');
    expect(audioInstances[0].play).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('ready-order-spotlight')).toBeTruthy();
    expect(screen.getAllByText('19')).toHaveLength(2);

    const highlightedRow = screen
      .getAllByText('19')
      .map((node) => node.closest('[data-highlighted]'))
      .find(Boolean);
    expect(highlightedRow?.getAttribute('data-highlighted')).toBe('true');

    await act(async () => vi.advanceTimersByTime(5000));

    expect(screen.getByTestId('ready-order-spotlight')).toBeTruthy();

    await act(async () => audioInstances[0].dispatchEvent(new Event('ended')));

    expect(screen.queryByTestId('ready-order-spotlight')).toBeNull();
    expect(screen.getByText('19').closest('[data-highlighted]')?.getAttribute('data-highlighted')).toBe('false');
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

    expect(audioInstances).toHaveLength(1);
    expect(screen.getByTestId('ready-order-spotlight').textContent).toContain('20');
    expect(screen.getAllByText('20')).toHaveLength(2);
    expect(screen.getAllByText('19')).toHaveLength(1);

    expect(
      screen
        .getAllByText('20')
        .map((node) => node.closest('[data-highlighted]'))
        .find(Boolean)
        ?.getAttribute('data-highlighted'),
    ).toBe('true');
    expect(screen.getByText('19').closest('[data-highlighted]')?.getAttribute('data-highlighted')).toBe('false');

    await act(async () => audioInstances[0].dispatchEvent(new Event('ended')));

    expect(audioInstances).toHaveLength(2);
    expect(audioInstances[1].src).toContain('/19.mp3');
    expect(screen.getByTestId('ready-order-spotlight').textContent).toContain('19');
  });

  it('uses the same audio-bound spotlight on the light compact monitor', async () => {
    useKitchenMonitorQueryMock
      .mockReturnValueOnce({
        data: { monitorVariant: 'light_compact', preparing: [], recentlyDone: [], announcements: [] },
      })
      .mockReturnValue({
        data: {
          monitorVariant: 'light_compact',
          preparing: [],
          recentlyDone: [
            {
              id: 'done-128',
              orderId: 'order-128',
              orderNumber: 3718,
              displayName: '128',
              status: 'done',
              completedAt: '2026-08-06T10:00:00Z',
            },
          ],
          announcements: [
            {
              id: 'announcement-128',
              orderId: 'order-128',
              orderNumber: 3718,
              displayName: '128',
              locale: 'uz',
              kind: 'auto',
              createdAt: '2026-08-06T10:00:00Z',
            },
          ],
        },
      });

    const { rerender } = render(<KitchenMonitorPage />);
    rerender(<KitchenMonitorPage />);
    await act(async () => {});

    expect(screen.getByTestId('ready-order-spotlight').textContent).toContain('128');
    expect(audioInstances[0].src).toContain('/128.mp3');
    expect(document.querySelector('[data-monitor-ticket-id="done-128"]')?.getAttribute('data-highlighted')).toBe(
      'true',
    );

    await act(async () => audioInstances[0].dispatchEvent(new Event('ended')));
    expect(screen.queryByTestId('ready-order-spotlight')).toBeNull();
  });
});
