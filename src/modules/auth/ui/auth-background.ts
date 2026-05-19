import type { PosRestaurantContext } from '../domain';

export const POS_AUTH_BACKGROUND_FALLBACK = '/pos-auth-bg-source.png';

export function resolvePosAuthBackgroundImage(restaurantContext?: PosRestaurantContext | null) {
  return restaurantContext?.posAuthBackgroundImageUrl || POS_AUTH_BACKGROUND_FALLBACK;
}
