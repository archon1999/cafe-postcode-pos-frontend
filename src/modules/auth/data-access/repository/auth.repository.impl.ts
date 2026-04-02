import axios from 'axios';

import type {
  AuthRepository,
  PosLoginPayload,
  PosRestaurantCodePayload,
  PosRestaurantContext,
  PosSessionPayload,
} from 'modules/auth/domain';
import { apiPost } from 'shared/api/client';

import { normalizeSessionPayload } from '../storage/session.storage';

function extractErrorMessage(payload: unknown): string | null {
  if (typeof payload === 'string' && payload.trim()) {
    return payload;
  }

  if (Array.isArray(payload)) {
    for (const item of payload) {
      const message = extractErrorMessage(item);
      if (message) {
        return message;
      }
    }
    return null;
  }

  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;

    for (const key of ['pin', 'detail', 'nonFieldErrors', 'non_field_errors', 'message']) {
      const message = extractErrorMessage(record[key]);
      if (message) {
        return message;
      }
    }

    for (const value of Object.values(record)) {
      const message = extractErrorMessage(value);
      if (message) {
        return message;
      }
    }
  }

  return null;
}

class PosAuthRepositoryImpl implements AuthRepository {
  async resolveRestaurant(payload: PosRestaurantCodePayload): Promise<PosRestaurantContext> {
    try {
      return await apiPost<PosRestaurantContext>('/pos/auth/restaurant-code/', payload);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const message = extractErrorMessage(error.response?.data);
        throw new Error(message || 'Restaurant login failed');
      }

      throw error;
    }
  }

  async loginWithPin(payload: PosLoginPayload): Promise<PosSessionPayload> {
    try {
      const session = normalizeSessionPayload(await apiPost<PosSessionPayload>('/pos/auth/pin-login/', payload));

      if (!session) {
        throw new Error('PIN login did not return a session');
      }

      return session;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const message = extractErrorMessage(error.response?.data);
        throw new Error(message || 'PIN login failed');
      }

      throw error;
    }
  }
}

export const authRepository: AuthRepository = new PosAuthRepositoryImpl();
