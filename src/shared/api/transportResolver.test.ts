// @vitest-environment jsdom

import axios from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { readTransportConnection } from './edgeConnection';
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
});
