import { describe, expect, it } from 'vitest';

import type { PosSessionPayload, PosUser } from '../entities';

import {
  canAccessCashier,
  canAccessCashierBuilder,
  canAccessCashierPayments,
  canAccessCashierTableSession,
  canAccessTableSessionEditor,
  canAccessTableSessionMenu,
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

function createSession(user: PosUser, overrides: Partial<PosSessionPayload> = {}): PosSessionPayload {
  return {
    token: 'token',
    user,
    ...(user.restaurantAccessActive !== undefined ? { restaurantAccessActive: user.restaurantAccessActive } : {}),
    ...overrides,
  };
}

describe('auth access utils', () => {
  it('detects hall and cashier-builder modes from permission codes', () => {
    expect(isHallMode(createUser({ permissionCodes: ['pos_halls.view'] }))).toBe(true);
    expect(isCashierBuilderMode(createUser({ permissionCodes: ['pos_halls.view'] }))).toBe(false);
    expect(isCashierBuilderMode(createUser({ permissionCodes: ['pos_takeaway_menu.view'] }))).toBe(true);
  });

  it('uses separate waiter permissions for halls, tables, menu, and reservations', () => {
    const waiter = createUser({
      permissionCodes: ['pos_halls.view', 'pos_tables.manage', 'pos_table_menu.view', 'pos_table_reservations.manage'],
    });

    expect(canAccessWaiter(waiter)).toBe(true);
    expect(canAccessWaiterTables(waiter)).toBe(true);
    expect(canAccessWaiterMenu(waiter)).toBe(true);
    expect(canManageTableReservations(waiter)).toBe(true);

    const tableRunner = createUser({ permissionCodes: ['pos_tables.manage'] });
    expect(canAccessWaiter(tableRunner)).toBe(false);
    expect(canAccessWaiterTables(tableRunner)).toBe(true);
  });

  it('routes kitchen-only roles to the kitchen queue before other surfaces', () => {
    const chef = createUser({
      permissionCodes: ['pos_kitchen_orders.view', 'pos_kitchen_orders.update'],
      role: {
        id: 'role-chef',
        name: 'Chef',
      },
    });

    expect(canAccessKitchen(chef)).toBe(true);
    expect(canManageKitchenOrders(chef)).toBe(true);
    expect(getPosHomePath(createSession(chef))).toBe('/kitchen/queue');
  });

  it('treats cashier builder and payment permissions as distinct capabilities', () => {
    const cashier = createUser({
      permissionCodes: ['pos_takeaway_menu.view', 'pos_open_checks.view', 'pos_payments.create'],
      role: {
        id: 'role-cashier',
        name: 'Cashier',
      },
    });

    expect(canAccessCashier(cashier)).toBe(true);
    expect(canAccessCashierPayments(cashier)).toBe(true);
    expect(canManageCashierPayments(cashier)).toBe(true);
    expect(canAccessCashierBuilder(cashier)).toBe(true);
    expect(canAccessTakeawayBuilder(cashier)).toBe(true);
    expect(getPosHomePath(createSession(cashier))).toBe('/cashier/builder');

    const paymentsOnlyCashier = createUser({
      permissionCodes: ['pos_open_checks.view', 'pos_payments.create'],
    });

    expect(canAccessCashier(paymentsOnlyCashier)).toBe(true);
    expect(canAccessCashierBuilder(paymentsOnlyCashier)).toBe(false);
    expect(getPosHomePath(createSession(paymentsOnlyCashier))).toBe('/cashier/open-checks');
  });

  it('allows table-session access from open-checks only for cashier-origin requests', () => {
    const waiter = createUser({
      permissionCodes: ['pos_tables.manage', 'pos_table_menu.view'],
    });
    const cashier = createUser({
      permissionCodes: ['pos_open_checks.view', 'pos_payments.create'],
      role: {
        id: 'role-cashier',
        name: 'Cashier',
      },
    });

    expect(canAccessTableSessionEditor(waiter)).toBe(true);
    expect(canAccessTableSessionMenu(waiter)).toBe(true);

    expect(canAccessCashierTableSession(cashier, 'cashier')).toBe(true);
    expect(canAccessTableSessionEditor(cashier, 'cashier')).toBe(true);
    expect(canAccessTableSessionMenu(cashier, 'cashier')).toBe(true);

    expect(canAccessCashierTableSession(cashier)).toBe(false);
    expect(canAccessTableSessionEditor(cashier)).toBe(false);
    expect(canAccessTableSessionMenu(cashier)).toBe(false);
  });

  it('accepts legacy cashier permission aliases', () => {
    const legacyCashier = createUser({
      permissionCodes: ['catalog_menu.view', 'open_checks.view', 'payments.create'],
      role: {
        id: 'role-cashier',
        name: 'Cashier',
      },
    });

    expect(canAccessTakeawayBuilder(legacyCashier)).toBe(true);
    expect(canAccessCashierPayments(legacyCashier)).toBe(true);
    expect(canManageCashierPayments(legacyCashier)).toBe(true);
    expect(getPosHomePath(createSession(legacyCashier))).toBe('/cashier/builder');
  });

  it('falls back to lock screen when restaurant access is disabled', () => {
    const blockedUser = createUser({
      restaurantAccessActive: false,
      permissionCodes: ['pos_halls.view', 'pos_open_checks.view'],
      role: {
        id: 'role-guest',
        name: 'Guest',
      },
    });

    expect(isHallMode(blockedUser)).toBe(false);
    expect(canAccessCashier(blockedUser)).toBe(false);
    expect(getPosHomePath(createSession(blockedUser))).toBe('/lock-screen');
  });

  it('hides the dock when only one top-level surface is available', () => {
    const chef = createUser({
      permissionCodes: ['pos_kitchen_orders.view'],
      role: {
        id: 'role-chef',
        name: 'Chef',
      },
    });

    expect(getAccessiblePosSurfaces(createSession(chef))).toEqual(['kitchen']);
    expect(shouldShowDock(createSession(chef))).toBe(false);
  });

  it('shows the dock when waiter and cashier surfaces are both available', () => {
    const mixedOperator = createUser({
      permissionCodes: ['pos_halls.view', 'pos_open_checks.view'],
      role: {
        id: 'role-operator',
        name: 'Universal operator',
      },
    });

    expect(getAccessiblePosSurfaces(createSession(mixedOperator))).toEqual(['halls', 'cashier']);
    expect(shouldShowDock(createSession(mixedOperator))).toBe(true);
  });
});
