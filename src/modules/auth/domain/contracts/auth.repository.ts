import type { PosLoginPayload, PosRestaurantCodePayload, PosRestaurantContext, PosSessionPayload } from '../entities';

export interface AuthRepository {
  resolveRestaurant(payload: PosRestaurantCodePayload): Promise<PosRestaurantContext>;
  loginWithPin(payload: PosLoginPayload): Promise<PosSessionPayload>;
}
