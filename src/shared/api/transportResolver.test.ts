// @vitest-environment jsdom

import axios from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { persistTransportConnection, readTransportConnection } from './edgeConnection';
import { resolveRestaurantTransport } from './transportResolver';

vi.mock('axios');

const mockedAxios = vi.mocked(axios, true);

describe('restaurant transport resolver', () => {
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

  it('checks restaurant codes against the remote backend before using a cached local agent', async () => {
    persistTransportConnection({
      mode: 'router',
      restaurantId: 'qamish',
      origin: 'http://127.0.0.1:18181',
      token: 'ept_qamish',
    });
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        restaurantId: 'new-york',
        restaurantName: 'New York',
        coordinator: null,
      },
    });

    const context = await resolveRestaurantTransport('NY1111');

    expect(context.restaurantId).toBe('new-york');
    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.stringContaining('/pos/auth/restaurant-code/'),
      expect.objectContaining({ code: 'NY1111' }),
      expect.any(Object),
    );
    expect(fetch).not.toHaveBeenCalledWith(
      'http://127.0.0.1:18181/v1/pos/auth/restaurant-code/',
      expect.anything(),
    );
    expect(readTransportConnection()).toMatchObject({ mode: 'remote', restaurantId: 'new-york' });
  });
});
