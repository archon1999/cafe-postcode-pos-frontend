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
          ui_mode: 'pos',
          permission_codes: ['orders.manage'],
        },
        feature_config: {
          id: 'feature-1',
          hall_enabled: true,
          kitchen_enabled: false,
          cashier_enabled: true,
          owner_dashboard_enabled: false,
          order_entry_mode: 'cashier_builder',
          kitchen_mode: 'display',
          enabled_modules: ['cashier'],
          enabled_roles: ['cashier'],
        },
      }),
    );

    expect(readStoredSession()).toEqual<PosSessionPayload>({
      token: 'legacy-token',
      user: {
        id: 'user-1',
        username: 'legacy',
        fullName: 'Legacy User',
        permissionCodes: ['orders.manage'],
      },
      featureConfig: {
        id: 'feature-1',
        hallEnabled: true,
        kitchenEnabled: false,
        cashierEnabled: true,
        ownerDashboardEnabled: false,
        orderEntryMode: 'cashier_builder',
        kitchenMode: 'display',
        enabledModules: ['cashier'],
        enabledRoles: ['cashier'],
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
        permissionCodes: ['payments.manage'],
      },
      featureConfig: {
        id: 'feature-2',
        hallEnabled: true,
        kitchenEnabled: true,
        cashierEnabled: true,
        ownerDashboardEnabled: false,
        orderEntryMode: 'hall',
        kitchenMode: 'both',
        enabledModules: ['hall', 'cashier'],
        enabledRoles: ['manager'],
      },
    });

    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')).toEqual({
      token: 'token',
      user: {
        id: 'user-2',
        username: 'operator',
        fullName: 'POS Operator',
        permissionCodes: ['payments.manage'],
      },
      featureConfig: {
        id: 'feature-2',
        hallEnabled: true,
        kitchenEnabled: true,
        cashierEnabled: true,
        ownerDashboardEnabled: false,
        orderEntryMode: 'hall',
        kitchenMode: 'both',
        enabledModules: ['hall', 'cashier'],
        enabledRoles: ['manager'],
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
          permissionCodes: ['kitchen.view'],
        },
        featureConfig: {
          id: 'feature-3',
          hall_enabled: false,
          kitchenEnabled: true,
          cashier_enabled: false,
          ownerDashboardEnabled: false,
          order_entry_mode: 'hall',
          kitchenMode: 'printer',
          enabled_modules: ['kitchen'],
          enabledRoles: ['chef'],
        },
      }),
    ).toEqual({
      token: 'token',
      user: {
        id: 'user-3',
        username: 'mixed',
        fullName: 'Mixed User',
        permissionCodes: ['kitchen.view'],
      },
      featureConfig: {
        id: 'feature-3',
        hallEnabled: false,
        kitchenEnabled: true,
        cashierEnabled: false,
        ownerDashboardEnabled: false,
        orderEntryMode: 'hall',
        kitchenMode: 'printer',
        enabledModules: ['kitchen'],
        enabledRoles: ['chef'],
      },
    });
  });
});
