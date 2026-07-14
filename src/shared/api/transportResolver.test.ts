// @vitest-environment jsdom

import axios from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { persistTransportConnection, readTransportConnection } from './edgeConnection';
import { refreshTransportMode, resolveRestaurantTransport } from './transportResolver';

vi.mock('axios');

const mockedAxios = vi.mocked(axios, true);

describe('restaurant transport resolver', () => {
  const fetchMock = () => vi.mocked(fetch);

  beforeEach(() => {
    window.localStorage.clear();
    mockedAxios.post.mockReset();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('ignores invalid coordinator URLs and falls back to remote mode', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        restaurantId: 'restaurant-1',
        restaurantName: 'Qamish',
        coordinator: {
          restaurantId: 'restaurant-1',
          edgeToken: 'ept_terminal',
          coordinatorUrls: [null, '', 'not-a-url'],
        },
      },
    });

    const context = await resolveRestaurantTransport('ABC123');

    expect(context.restaurantId).toBe('restaurant-1');
    expect(readTransportConnection()).toMatchObject({ mode: 'remote', restaurantId: 'restaurant-1' });
    expect(fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:18181/health',
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-Edge-Token': 'ept_terminal' }),
      }),
    );
  });

  it('uses the loopback local agent before the remote backend when the offline context matches', async () => {
    fetchMock()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ restaurantId: 'qamish', restaurantName: 'Qamish' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ restaurantId: 'qamish', backendOnline: false }),
      } as Response);

    const context = await resolveRestaurantTransport('ABC123');

    expect(context.restaurantId).toBe('qamish');
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      'http://127.0.0.1:18181/v1/pos/auth/restaurant-code/',
      expect.objectContaining({ body: expect.stringContaining('ABC123') }),
    );
    expect(mockedAxios.post).not.toHaveBeenCalled();
    expect(readTransportConnection()).toMatchObject({
      mode: 'local',
      restaurantId: 'qamish',
      origin: 'http://127.0.0.1:18181',
    });
  });

  it('labels a loopback agent as local even while its backend connection is online', async () => {
    fetchMock()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ restaurantId: 'new-york', restaurantName: 'New York' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ restaurantId: 'new-york', backendOnline: true }),
      } as Response);

    await resolveRestaurantTransport('NY1111');

    expect(readTransportConnection()).toMatchObject({
      mode: 'local',
      restaurantId: 'new-york',
      origin: 'http://127.0.0.1:18181',
      backendOnline: true,
    });
  });

  it('can refresh a tokenless loopback connection without falling back to remote', async () => {
    persistTransportConnection({
      mode: 'local',
      restaurantId: 'new-york',
      origin: 'http://127.0.0.1:18181',
      backendOnline: true,
    });
    fetchMock().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ restaurantId: 'new-york', backendOnline: true }),
    } as Response);

    const result = await refreshTransportMode();

    expect(result).toMatchObject({ mode: 'local', requiresRelogin: false });
    expect(readTransportConnection()).toMatchObject({ mode: 'local', restaurantId: 'new-york' });
  });

  it('checks the cached LAN agent after loopback and before the remote backend', async () => {
    persistTransportConnection({
      mode: 'router',
      restaurantId: 'qamish',
      origin: 'http://192.168.1.20:18181',
      token: 'ept_qamish',
    });
    fetchMock()
      .mockRejectedValueOnce(new Error('loopback unavailable'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ restaurantId: 'qamish', restaurantName: 'Qamish' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ restaurantId: 'qamish', backendOnline: true }),
      } as Response);

    const context = await resolveRestaurantTransport('ABC123');

    expect(context.restaurantId).toBe('qamish');
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      'http://192.168.1.20:18181/v1/pos/auth/restaurant-code/',
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-Edge-Token': 'ept_qamish' }),
      }),
    );
    expect(mockedAxios.post).not.toHaveBeenCalled();
    expect(readTransportConnection()).toMatchObject({ mode: 'router', restaurantId: 'qamish' });
  });

  it('falls back to the remote backend when loopback and LAN agents are unavailable', async () => {
    persistTransportConnection({
      mode: 'router',
      restaurantId: 'qamish',
      origin: 'http://192.168.1.20:18181',
      token: 'ept_qamish',
    });
    fetchMock().mockRejectedValue(new Error('local unavailable'));
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        restaurantId: 'new-york',
        restaurantName: 'New York',
        coordinator: null,
      },
    });

    const context = await resolveRestaurantTransport('NY1111');

    expect(fetch).toHaveBeenNthCalledWith(1, 'http://127.0.0.1:18181/v1/pos/auth/restaurant-code/', expect.anything());
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      'http://192.168.1.20:18181/v1/pos/auth/restaurant-code/',
      expect.anything(),
    );
    expect(context.restaurantId).toBe('new-york');
    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.stringContaining('/pos/auth/restaurant-code/'),
      expect.objectContaining({ code: 'NY1111' }),
      expect.any(Object),
    );
    expect(readTransportConnection()).toMatchObject({ mode: 'remote', restaurantId: 'new-york' });
  });
});
