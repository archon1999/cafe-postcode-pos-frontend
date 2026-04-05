/* @vitest-environment jsdom */

import { afterEach, describe, expect, it } from 'vitest';

import type { PosSessionPayload } from 'modules/auth/domain';

import { normalizeSessionPayload, persistSession, readStoredSession } from './session.storage';

const STORAGE_KEY = 'restaurant-pos-session';

afterEach(() => {
  localStorage.clear();
});

describe('session storage', () => {
  it('normalizes legacy snake_case session payloads to camelCase', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        token: 'legacy-token',
        user: {
          id: 'user-1',
          username: 'legacy',
          full_name: 'Legacy User',
          permission_codes: ['pos_takeaway_menu.view'],
        },
        restaurant_access_active: true,
        role_codes: ['cashier'],
        tariff: {
          id: 'tariff-1',
          name: 'Starter',
          permission_codes: ['pos_takeaway_menu.view'],
          role_codes: ['cashier'],
        },
        restaurant_context: {
          restaurantId: 'restaurant-1',
          restaurantName: 'Legacy Cafe',
        },
      }),
    );

    expect(readStoredSession()).toEqual<PosSessionPayload>({
      token: 'legacy-token',
      user: {
        id: 'user-1',
        username: 'legacy',
        fullName: 'Legacy User',
        permissionCodes: ['pos_takeaway_menu.view'],
        restaurantAccessActive: true,
      },
      restaurantAccessActive: true,
      roleCodes: ['cashier'],
      tariff: {
        id: 'tariff-1',
        name: 'Starter',
        permissionCodes: ['pos_takeaway_menu.view'],
        roleCodes: ['cashier'],
      },
      restaurantContext: {
        restaurantId: 'restaurant-1',
        restaurantName: 'Legacy Cafe',
      },
    });
  });

  it('persists normalized sessions using camelCase keys', () => {
    persistSession({
      token: 'token',
      user: {
        id: 'user-2',
        username: 'operator',
        fullName: 'POS Operator',
        permissionCodes: ['pos_payments.create'],
        restaurantAccessActive: true,
      },
      restaurantAccessActive: true,
      roleCodes: ['cashier'],
      tariff: {
        id: 'tariff-2',
        name: 'Pro',
        permissionCodes: ['pos_payments.create'],
        roleCodes: ['cashier'],
      },
      restaurantContext: {
        restaurantId: 'restaurant-2',
        restaurantName: 'Cafe Pro',
      },
    });

    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')).toEqual({
      token: 'token',
      user: {
        id: 'user-2',
        username: 'operator',
        fullName: 'POS Operator',
        permissionCodes: ['pos_payments.create'],
        restaurantAccessActive: true,
      },
      restaurantAccessActive: true,
      roleCodes: ['cashier'],
      tariff: {
        id: 'tariff-2',
        name: 'Pro',
        permissionCodes: ['pos_payments.create'],
        roleCodes: ['cashier'],
      },
      restaurantContext: {
        restaurantId: 'restaurant-2',
        restaurantName: 'Cafe Pro',
      },
    });
  });

  it('normalizes mixed legacy and camelCase payloads in memory', () => {
    expect(
      normalizeSessionPayload({
        token: 'token',
        user: {
          id: 'user-3',
          username: 'mixed',
          full_name: 'Mixed User',
          permissionCodes: ['pos_kitchen_orders.view'],
        },
        restaurant_access_active: false,
        roleCodes: ['chef'],
        tariff: {
          id: 'tariff-3',
          name: 'Kitchen',
          permission_codes: ['pos_kitchen_orders.view'],
          roleCodes: ['chef'],
        },
      }),
    ).toEqual({
      token: 'token',
      user: {
        id: 'user-3',
        username: 'mixed',
        fullName: 'Mixed User',
        permissionCodes: ['pos_kitchen_orders.view'],
        restaurantAccessActive: false,
      },
      restaurantAccessActive: false,
      roleCodes: ['chef'],
      tariff: {
        id: 'tariff-3',
        name: 'Kitchen',
        permissionCodes: ['pos_kitchen_orders.view'],
        roleCodes: ['chef'],
      },
    });
  });
});
