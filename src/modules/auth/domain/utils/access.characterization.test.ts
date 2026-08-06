import { describe, expect, it } from 'vitest';

import type { PosSessionPayload, PosUser } from '../entities';

import {
  canAccessCashierBuilder,
  canAccessCashierPayments,
  canAccessKitchen,
  canAccessWaiter,
  canAccessWaiterMenu,
  canAccessWaiterTables,
  canAddCashierPaymentOrderItems,
  canCancelKitchenOrders,
  canManageCashShift,
  canManageCashierPayments,
  canManageFiscalShift,
  canManageKitchenOrders,
  canManageTableReservations,
  canRemoveCashierPaymentOrderItems,
  canSkipFiscalReceipts,
  canViewCashShift,
  getAccessiblePosSurfaces,
  getPosHomePath,
  shouldShowDock,
} from './access';

const permissions = {
  waiter: ['pos_halls.view', 'pos_table_menu.view', 'pos_tables.manage'],
  manager: [
    'pos_cash_shift.view',
    'pos_cash_shift.manage',
    'pos_fiscal_receipts.skip',
    'pos_fiscal_shift.manage',
    'pos_halls.view',
    'pos_open_checks.view',
    'pos_payments.create',
    'pos_table_menu.view',
    'pos_table_reservations.manage',
    'pos_tables.manage',
    'pos_takeaway_menu.view',
  ],
  cashier: ['pos_fiscal_receipts.skip', 'pos_open_checks.view', 'pos_payments.create', 'pos_takeaway_menu.view'],
  fast_food_cashier: [
    'pos_fiscal_receipts.skip',
    'pos_open_checks.view',
    'pos_payment_order_items.create',
    'pos_payment_order_items.delete',
    'pos_payments.create',
    'pos_takeaway_menu.view',
  ],
  chef: ['pos_kitchen_orders.update', 'pos_kitchen_orders.view'],
  head_chef: [
    'pos_kitchen_orders.cancel',
    'pos_kitchen_orders.update',
    'pos_kitchen_orders.view',
    'pos_kitchen_orders.view_all',
  ],
  restaurant_admin: [],
  legacy_cashier: ['catalog_menu.view', 'open_checks.view', 'payments.create'],
} as const;

function user(role: keyof typeof permissions, restaurantAccessActive = true): PosUser {
  return {
    id: `user:${role}`,
    username: role,
    fullName: role,
    restaurantAccessActive,
    permissionCodes: [...permissions[role]],
    role: { id: `role:${role}`, name: role },
  };
}

function projection(actor: PosUser) {
  const session = {
    token: 'test-token',
    user: actor,
    restaurantAccessActive: actor.restaurantAccessActive,
  } as PosSessionPayload;
  return {
    surfaces: getAccessiblePosSurfaces(session),
    home: getPosHomePath(session),
    dock: shouldShowDock(session),
    operations: {
      halls: canAccessWaiter(actor),
      tables: canAccessWaiterTables(actor),
      tableMenu: canAccessWaiterMenu(actor),
      reservations: canManageTableReservations(actor),
      cashierBuilder: canAccessCashierBuilder(actor),
      openChecks: canAccessCashierPayments(actor),
      payments: canManageCashierPayments(actor),
      cashShift: canManageCashShift(actor),
      viewCashShift: canViewCashShift(actor),
      fiscalSkip: canSkipFiscalReceipts(actor),
      fiscalShift: canManageFiscalShift(actor),
      addPaymentItem: canAddCashierPaymentOrderItems(actor),
      removePaymentItem: canRemoveCashierPaymentOrderItems(actor),
      kitchen: canAccessKitchen(actor),
      kitchenUpdate: canManageKitchenOrders(actor),
      kitchenCancel: canCancelKitchenOrders(actor),
    },
  };
}

const none = {
  halls: false,
  tables: false,
  tableMenu: false,
  reservations: false,
  cashierBuilder: false,
  openChecks: false,
  payments: false,
  cashShift: false,
  viewCashShift: false,
  fiscalSkip: false,
  fiscalShift: false,
  addPaymentItem: false,
  removePaymentItem: false,
  kitchen: false,
  kitchenUpdate: false,
  kitchenCancel: false,
};

describe('POS RBAC projection characterization', () => {
  it('preserves the canonical role, legacy, and disabled-access matrix', () => {
    expect({
      waiter: projection(user('waiter')),
      manager: projection(user('manager')),
      cashier: projection(user('cashier')),
      fastFoodCashier: projection(user('fast_food_cashier')),
      chef: projection(user('chef')),
      headChef: projection(user('head_chef')),
      restaurantAdmin: projection(user('restaurant_admin')),
      legacyCashier: projection(user('legacy_cashier')),
      disabledManager: projection(user('manager', false)),
    }).toEqual({
      waiter: {
        surfaces: ['halls'],
        home: '/waiter/halls',
        dock: false,
        operations: { ...none, halls: true, tables: true, tableMenu: true },
      },
      manager: {
        surfaces: ['halls', 'cashier'],
        home: '/cashier/builder',
        dock: true,
        operations: {
          ...none,
          halls: true,
          tables: true,
          tableMenu: true,
          reservations: true,
          cashierBuilder: true,
          openChecks: true,
          payments: true,
          cashShift: true,
          viewCashShift: true,
          fiscalSkip: true,
          fiscalShift: true,
        },
      },
      cashier: {
        surfaces: ['cashier'],
        home: '/cashier/builder',
        dock: false,
        operations: {
          ...none,
          cashierBuilder: true,
          openChecks: true,
          payments: true,
          fiscalSkip: true,
        },
      },
      fastFoodCashier: {
        surfaces: ['cashier'],
        home: '/cashier/builder',
        dock: false,
        operations: {
          ...none,
          cashierBuilder: true,
          openChecks: true,
          payments: true,
          fiscalSkip: true,
          addPaymentItem: true,
          removePaymentItem: true,
        },
      },
      chef: {
        surfaces: ['kitchen'],
        home: '/kitchen/queue',
        dock: false,
        operations: { ...none, kitchen: true, kitchenUpdate: true },
      },
      headChef: {
        surfaces: ['kitchen'],
        home: '/kitchen/queue',
        dock: false,
        operations: {
          ...none,
          kitchen: true,
          kitchenUpdate: true,
          kitchenCancel: true,
        },
      },
      restaurantAdmin: {
        surfaces: [],
        home: '/lock-screen',
        dock: false,
        operations: none,
      },
      legacyCashier: {
        surfaces: ['cashier'],
        home: '/cashier/builder',
        dock: false,
        operations: {
          ...none,
          tableMenu: true,
          cashierBuilder: true,
          openChecks: true,
          payments: true,
        },
      },
      disabledManager: {
        surfaces: [],
        home: '/lock-screen',
        dock: false,
        operations: none,
      },
    });
  });
});
