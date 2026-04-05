import type { PosSessionPayload, PosUser } from '../entities';

const POS_HALLS_VIEW = 'pos_halls.view';
const POS_TABLES_MANAGE = 'pos_tables.manage';
const POS_TABLE_MENU_VIEW = 'pos_table_menu.view';
const POS_TAKEAWAY_MENU_VIEW = 'pos_takeaway_menu.view';
const POS_KITCHEN_ORDERS_VIEW = 'pos_kitchen_orders.view';
const POS_KITCHEN_ORDERS_UPDATE = 'pos_kitchen_orders.update';
const POS_OPEN_CHECKS_VIEW = 'pos_open_checks.view';
const POS_PAYMENTS_CREATE = 'pos_payments.create';
const POS_TABLE_RESERVATIONS_MANAGE = 'pos_table_reservations.manage';
const LEGACY_CATALOG_MENU_VIEW = 'catalog_menu.view';
const LEGACY_KITCHEN_QUEUE_VIEW = 'kitchen_queue.view';
const LEGACY_OPEN_CHECKS_VIEW = 'open_checks.view';
const LEGACY_PAYMENTS_CREATE = 'payments.create';

export function hasPermission(user: PosUser | null | undefined, permissionCode: string) {
  return Boolean(user?.permissionCodes?.includes(permissionCode));
}

function hasAnyPermission(user: PosUser | null | undefined, permissionCodes: string[]) {
  return permissionCodes.some((permissionCode) => hasPermission(user, permissionCode));
}

function isRestaurantAccessEnabled(user: PosUser | null | undefined) {
  if (!user) {
    return false;
  }

  if (user.restaurantAccessActive === false) {
    return false;
  }

  return true;
}

export function isHallMode(user: PosUser | null | undefined) {
  if (!isRestaurantAccessEnabled(user)) {
    return false;
  }

  return hasAnyPermission(user, [
    POS_HALLS_VIEW,
    POS_TABLES_MANAGE,
    POS_TABLE_MENU_VIEW,
    POS_TABLE_RESERVATIONS_MANAGE,
    LEGACY_CATALOG_MENU_VIEW,
  ]);
}

export function isCashierBuilderMode(user: PosUser | null | undefined) {
  if (!isRestaurantAccessEnabled(user)) {
    return false;
  }

  return hasAnyPermission(user, [POS_TAKEAWAY_MENU_VIEW, LEGACY_CATALOG_MENU_VIEW]);
}

export function canAccessWaiter(user: PosUser | null | undefined) {
  if (!isHallMode(user)) {
    return false;
  }

  return hasPermission(user, POS_HALLS_VIEW);
}

export function canAccessWaiterTables(user: PosUser | null | undefined) {
  if (!isHallMode(user)) {
    return false;
  }

  return hasPermission(user, POS_TABLES_MANAGE);
}

export function canAccessWaiterMenu(user: PosUser | null | undefined) {
  if (!isHallMode(user)) {
    return false;
  }

  return hasAnyPermission(user, [POS_TABLE_MENU_VIEW, LEGACY_CATALOG_MENU_VIEW]);
}

export function canManageTableReservations(user: PosUser | null | undefined) {
  if (!isHallMode(user)) {
    return false;
  }

  return hasPermission(user, POS_TABLE_RESERVATIONS_MANAGE);
}

export function canAccessCashierBuilder(user: PosUser | null | undefined) {
  if (!isCashierBuilderMode(user)) {
    return false;
  }

  return hasAnyPermission(user, [POS_TAKEAWAY_MENU_VIEW, LEGACY_CATALOG_MENU_VIEW]);
}

export function canAccessTakeawayBuilder(user: PosUser | null | undefined) {
  return canAccessCashierBuilder(user);
}

export function canAccessCashierPayments(user: PosUser | null | undefined) {
  if (!isRestaurantAccessEnabled(user)) {
    return false;
  }

  return hasAnyPermission(user, [POS_OPEN_CHECKS_VIEW, LEGACY_OPEN_CHECKS_VIEW]);
}

export function canManageCashierPayments(user: PosUser | null | undefined) {
  if (!isRestaurantAccessEnabled(user)) {
    return false;
  }

  return hasAnyPermission(user, [POS_PAYMENTS_CREATE, LEGACY_PAYMENTS_CREATE]);
}

export function canAccessCashier(user: PosUser | null | undefined) {
  return canAccessTakeawayBuilder(user) || canAccessCashierPayments(user);
}

export function canAccessKitchen(user: PosUser | null | undefined) {
  if (!isRestaurantAccessEnabled(user)) {
    return false;
  }

  return hasAnyPermission(user, [POS_KITCHEN_ORDERS_VIEW, LEGACY_KITCHEN_QUEUE_VIEW]);
}

export function canManageKitchenOrders(user: PosUser | null | undefined) {
  if (!isRestaurantAccessEnabled(user)) {
    return false;
  }

  return hasPermission(user, POS_KITCHEN_ORDERS_UPDATE);
}

export function getAccessiblePosSurfaces(session: PosSessionPayload | null | undefined) {
  const user = session?.user;
  const surfaces = [
    canAccessWaiter(user) ? 'halls' : null,
    canAccessCashier(user) ? 'cashier' : null,
    canAccessKitchen(user) ? 'kitchen' : null,
  ].filter(Boolean) as Array<'halls' | 'cashier' | 'kitchen'>;

  return surfaces;
}

export function shouldShowDock(session: PosSessionPayload | null | undefined) {
  return getAccessiblePosSurfaces(session).length > 1;
}

export function canAccessWaiterTakeaway(user: PosUser | null | undefined) {
  return canAccessTakeawayBuilder(user);
}

export function getPosHomePath(session: PosSessionPayload | null | undefined) {
  const user = session?.user;

  if (canAccessKitchen(user) && !canAccessWaiter(user) && !canAccessCashier(user)) {
    return '/kitchen/queue';
  }

  if (canAccessCashierBuilder(user)) {
    return '/cashier/builder';
  }

  if (canAccessWaiter(user)) {
    return '/waiter/halls';
  }

  if (canAccessTakeawayBuilder(user)) {
    return '/cashier/builder';
  }

  if (canAccessCashierPayments(user)) {
    return '/cashier/open-checks';
  }

  if (canAccessKitchen(user)) {
    return '/kitchen/queue';
  }

  return '/lock-screen';
}
