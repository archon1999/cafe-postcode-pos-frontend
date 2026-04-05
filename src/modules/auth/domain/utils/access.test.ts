import { describe, expect, it } from 'vitest';

import type { PosFeatureConfig, PosSessionPayload, PosUser } from '../entities';

import {
  canAccessCashier,
  canAccessCashierBuilder,
  canAccessCashierPayments,
  canAccessTakeawayBuilder,
  canAccessKitchen,
  canAccessWaiter,
  canAccessWaiterMenu,
  canAccessWaiterTables,
  canManageCashierPayments,
  canManageKitchenOrders,
  canManageTableReservations,
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

  it('uses separate waiter permissions for halls, tables, menu, and reservations', () => {
    const waiter = createUser({
      permissionCodes: ['pos_halls.view', 'pos_tables.manage', 'pos_table_menu.view', 'pos_table_reservations.manage'],
    });

    expect(canAccessWaiter(waiter, baseFeatureConfig)).toBe(true);
    expect(canAccessWaiterTables(waiter, baseFeatureConfig)).toBe(true);
    expect(canAccessWaiterMenu(waiter, baseFeatureConfig)).toBe(true);
    expect(canManageTableReservations(waiter, baseFeatureConfig)).toBe(true);
    expect(
      canAccessWaiter(createUser({ permissionCodes: ['pos_tables.manage'] }), {
        ...baseFeatureConfig,
        hallEnabled: false,
      }),
    ).toBe(false);
  });

  it('routes kitchen-only roles to the kitchen queue before other surfaces', () => {
    const chef = createUser({
      permissionCodes: ['pos_kitchen_orders.view', 'pos_kitchen_orders.update'],
      role: {
        id: 'role-chef',
        name: 'Chef',
      },
    });

    expect(canAccessKitchen(chef, baseFeatureConfig)).toBe(true);
    expect(canManageKitchenOrders(chef, baseFeatureConfig)).toBe(true);
    expect(getPosHomePath(createSession(chef, baseFeatureConfig))).toBe('/kitchen/queue');
  });

  it('treats cashier builder and open-checks as distinct permissions', () => {
    const cashier = createUser({
      permissionCodes: ['pos_takeaway_menu.view', 'pos_open_checks.view', 'pos_payments.create'],
      role: {
        id: 'role-cashier',
        name: 'Cashier',
      },
    });

    expect(canAccessCashier(cashier, baseFeatureConfig)).toBe(true);
    expect(canAccessCashierPayments(cashier, baseFeatureConfig)).toBe(true);
    expect(canManageCashierPayments(cashier, baseFeatureConfig)).toBe(true);
    expect(canAccessCashierBuilder(cashier, baseFeatureConfig)).toBe(false);
    expect(canAccessTakeawayBuilder(cashier, baseFeatureConfig)).toBe(true);
    expect(
      canAccessCashierBuilder(cashier, {
        ...baseFeatureConfig,
        orderEntryMode: 'cashier_builder',
      }),
    ).toBe(true);
    expect(
      canAccessTakeawayBuilder(cashier, {
        ...baseFeatureConfig,
        orderEntryMode: 'cashier_builder',
      }),
    ).toBe(true);
    expect(
      getPosHomePath(
        createSession(cashier, {
          ...baseFeatureConfig,
          orderEntryMode: 'cashier_builder',
        }),
      ),
    ).toBe('/cashier/builder');
    expect(getPosHomePath(createSession(cashier, baseFeatureConfig))).toBe('/cashier/builder');
  });

  it('accepts legacy cashier permission aliases for takeaway menu and payments', () => {
    const legacyCashier = createUser({
      permissionCodes: ['catalog_menu.view', 'open_checks.view', 'payments.create'],
      role: {
        id: 'role-cashier',
        name: 'Cashier',
      },
    });

    expect(canAccessTakeawayBuilder(legacyCashier, baseFeatureConfig)).toBe(true);
    expect(canAccessCashierPayments(legacyCashier, baseFeatureConfig)).toBe(true);
    expect(canManageCashierPayments(legacyCashier, baseFeatureConfig)).toBe(true);
    expect(getPosHomePath(createSession(legacyCashier, baseFeatureConfig))).toBe('/cashier/builder');
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

  it('hides the dock when only one top-level surface is available', () => {
    const chef = createUser({
      permissionCodes: ['pos_kitchen_orders.view'],
      role: {
        id: 'role-chef',
        name: 'Chef',
      },
    });

    expect(getAccessiblePosSurfaces(createSession(chef, baseFeatureConfig))).toEqual(['kitchen']);
    expect(shouldShowDock(createSession(chef, baseFeatureConfig))).toBe(false);
  });

  it('shows the dock when waiter and cashier surfaces are both available', () => {
    const mixedOperator = createUser({
      permissionCodes: ['pos_halls.view', 'pos_open_checks.view'],
      role: {
        id: 'role-operator',
        name: 'Universal operator',
      },
    });

    expect(getAccessiblePosSurfaces(createSession(mixedOperator, baseFeatureConfig))).toEqual(['halls', 'cashier']);
    expect(shouldShowDock(createSession(mixedOperator, baseFeatureConfig))).toBe(true);
  });
});
