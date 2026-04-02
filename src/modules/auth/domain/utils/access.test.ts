import { describe, expect, it } from 'vitest';

import type { PosFeatureConfig, PosSessionPayload, PosUser } from '../entities';

import {
  canAccessCashier,
  canAccessCashierBuilder,
  canAccessKitchen,
  canAccessWaiter,
  getAccessiblePosSurfaces,
  getPosHomePath,
  isCashierBuilderMode,
  isHallMode,
  shouldShowDock,
} from './access';

const baseFeatureConfig: PosFeatureConfig = {
  id: 'feature-1',
  hallEnabled: true,
  kitchenEnabled: true,
  cashierEnabled: true,
  ownerDashboardEnabled: false,
  orderEntryMode: 'hall',
  kitchenMode: 'display',
  enabledModules: [],
  enabledRoles: [],
  allowedPermissionCodes: [],
  allowedRoleCodes: [],
  restaurantAccessActive: true,
};

function createUser(overrides: Partial<PosUser> = {}): PosUser {
  return {
    id: 'user-1',
    username: 'operator',
    fullName: 'POS Operator',
    restaurantAccessActive: true,
    permissionCodes: [],
    role: {
      id: 'role-1',
      name: 'Waiter',
    },
    ...overrides,
  };
}

function createSession(user: PosUser, featureConfig: PosFeatureConfig): PosSessionPayload {
  return {
    token: 'token',
    user,
    featureConfig,
    restaurantAccessActive: true,
  };
}

describe('auth access utils', () => {
  it('detects hall and cashier-builder modes from feature config', () => {
    expect(isHallMode(baseFeatureConfig)).toBe(true);
    expect(isCashierBuilderMode(baseFeatureConfig)).toBe(false);
    expect(
      isCashierBuilderMode({
        ...baseFeatureConfig,
        orderEntryMode: 'cashier_builder',
      }),
    ).toBe(true);
  });

  it('grants waiter access only when hall mode is enabled', () => {
    const waiter = createUser({ permissionCodes: ['halls.list', 'orders.create'] });

    expect(canAccessWaiter(waiter, baseFeatureConfig)).toBe(true);
    expect(
      canAccessWaiter(waiter, {
        ...baseFeatureConfig,
        hallEnabled: false,
      }),
    ).toBe(false);
  });

  it('routes kitchen roles to the kitchen queue before cashier or waiter paths', () => {
    const chef = createUser({
      permissionCodes: ['kitchen_queue.view', 'kitchen_tickets.update'],
      role: {
        id: 'role-chef',
        name: 'Chef',
      },
    });

    expect(canAccessKitchen(chef, baseFeatureConfig)).toBe(true);
    expect(getPosHomePath(createSession(chef, baseFeatureConfig))).toBe('/kitchen/queue');
  });

  it('routes cashier users to builder or open checks based on order entry mode', () => {
    const cashier = createUser({
      permissionCodes: ['open_checks.list', 'payments.update'],
      role: {
        id: 'role-cashier',
        name: 'Cashier',
      },
    });

    expect(canAccessCashier(cashier, baseFeatureConfig)).toBe(true);
    expect(canAccessCashierBuilder(cashier, baseFeatureConfig)).toBe(false);
    expect(
      getPosHomePath(
        createSession(cashier, {
          ...baseFeatureConfig,
          orderEntryMode: 'cashier_builder',
        }),
      ),
    ).toBe('/cashier/builder');
    expect(getPosHomePath(createSession(cashier, baseFeatureConfig))).toBe('/cashier/open-checks');
  });

  it('falls back to lock screen when no module access is available', () => {
    const blockedUser = createUser({
      permissionCodes: [],
      role: {
        id: 'role-guest',
        name: 'Guest',
      },
    });

    expect(
      getPosHomePath(
        createSession(blockedUser, {
          ...baseFeatureConfig,
          hallEnabled: false,
          kitchenEnabled: false,
          cashierEnabled: false,
        }),
      ),
    ).toBe('/lock-screen');
  });

  it('hides dock when only one top-level surface is available', () => {
    const chef = createUser({
      permissionCodes: ['kitchen_queue.view'],
      role: {
        id: 'role-chef',
        name: 'Chef',
      },
    });

    expect(getAccessiblePosSurfaces(createSession(chef, baseFeatureConfig))).toEqual(['kitchen']);
    expect(shouldShowDock(createSession(chef, baseFeatureConfig))).toBe(false);
  });

  it('shows dock when multiple surfaces are available', () => {
    const cashier = createUser({
      permissionCodes: ['halls.list', 'open_checks.list', 'payments.update'],
      role: {
        id: 'role-cashier',
        name: 'Cashier',
      },
    });

    expect(getAccessiblePosSurfaces(createSession(cashier, baseFeatureConfig))).toEqual(['halls', 'cashier']);
    expect(shouldShowDock(createSession(cashier, baseFeatureConfig))).toBe(true);
  });
});
