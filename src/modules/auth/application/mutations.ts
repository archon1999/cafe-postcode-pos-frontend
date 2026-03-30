import { useMutation, type UseMutationOptions } from '@tanstack/react-query';

import type { PosLoginPayload, PosRestaurantCodePayload, PosRestaurantContext, PosSessionPayload } from 'modules/auth/domain';

import { authRepository } from '../data-access';
import { authKeys } from './keys';

export function usePinLoginMutation(
  options?: Omit<UseMutationOptions<PosSessionPayload, Error, PosLoginPayload, unknown>, 'mutationFn'>,
) {
  return useMutation({
    mutationKey: authKeys.login,
    mutationFn: (payload: PosLoginPayload) => authRepository.loginWithPin(payload),
    ...options,
  });
}

export function useRestaurantCodeMutation(
  options?: Omit<UseMutationOptions<PosRestaurantContext, Error, PosRestaurantCodePayload, unknown>, 'mutationFn'>,
) {
  return useMutation({
    mutationKey: [...authKeys.login, 'restaurant'],
    mutationFn: (payload: PosRestaurantCodePayload) => authRepository.resolveRestaurant(payload),
    ...options,
  });
}
