import { describe, expect, it } from 'vitest';

import { POS_AUTH_BACKGROUND_FALLBACK, resolvePosAuthBackgroundImage } from './auth-background';

describe('resolvePosAuthBackgroundImage', () => {
  it('returns custom restaurant auth background when present', () => {
    expect(
      resolvePosAuthBackgroundImage({
        restaurantId: 'restaurant-1',
        restaurantName: 'Restaurant',
        posAuthBackgroundImageUrl: 'https://cdn.example.com/login.png',
      }),
    ).toBe('https://cdn.example.com/login.png');
  });

  it('falls back to the bundled auth background when missing', () => {
    expect(resolvePosAuthBackgroundImage(null)).toBe(POS_AUTH_BACKGROUND_FALLBACK);
    expect(resolvePosAuthBackgroundImage({ restaurantId: 'restaurant-1', restaurantName: 'Restaurant' })).toBe(
      POS_AUTH_BACKGROUND_FALLBACK,
    );
  });
});
