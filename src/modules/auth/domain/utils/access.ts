import type { PosFeatureConfig, PosSessionPayload, PosUser } from '../entities';

const POS_HALLS_VIEW = 'pos_halls.view';
const POS_TABLES_MANAGE = 'pos_tables.manage';
const POS_TABLE_MENU_VIEW = 'pos_table_menu.view';
const POS_TAKEAWAY_MENU_VIEW = 'pos_takeaway_menu.view';
const POS_KITCHEN_ORDERS_VIEW = 'pos_kitchen_orders.view';
const POS_KITCHEN_ORDERS_UPDATE = 'pos_kitchen_orders.update';
const POS_OPEN_CHECKS_VIEW = 'pos_open_checks.view';
const POS_PAYMENTS_CREATE = 'pos_payments.create';
const POS_TABLE_RESERVATIONS_MANAGE = 'pos_table_reservations.manage';

export function hasPermission(user: PosUser | null | undefined, permissionCode: string) {
  return Boolean(user?.permissionCodes?.includes(permissionCode));
}

function isRestaurantAccessEnabled(user: PosUser | null | undefined, featureConfig?: PosFeatureConfig) {
  if (!user) {
    return false;
  }

  if (user.restaurantAccessActive === false) {
    return false;
  }

  if (featureConfig?.restaurantAccessActive === false) {
    return false;
  }

  return true;
}

export function isHallMode(featureConfig: PosFeatureConfig | null) {
  return Boolean(featureConfig?.hallEnabled && featureConfig?.orderEntryMode === 'hall');
}

export function isCashierBuilderMode(featureConfig: PosFeatureConfig | null) {
  return Boolean(featureConfig?.cashierEnabled && featureConfig?.orderEntryMode === 'cashier_builder');
}

export function canAccessWaiter(user: PosUser | null | undefined, featureConfig?: PosFeatureConfig | null) {
  if (!isRestaurantAccessEnabled(user, featureConfig ?? undefined) || !isHallMode(featureConfig ?? null)) {
    return false;
  }

  return hasPermission(user, POS_HALLS_VIEW);
}

export function canAccessWaiterTables(user: PosUser | null | undefined, featureConfig?: PosFeatureConfig | null) {
  if (!isRestaurantAccessEnabled(user, featureConfig ?? undefined) || !isHallMode(featureConfig ?? null)) {
    return false;
  }

  return hasPermission(user, POS_TABLES_MANAGE);
}

export function canAccessWaiterMenu(user: PosUser | null | undefined, featureConfig?: PosFeatureConfig | null) {
  if (!isRestaurantAccessEnabled(user, featureConfig ?? undefined) || !isHallMode(featureConfig ?? null)) {
    return false;
  }

  return hasPermission(user, POS_TABLE_MENU_VIEW);
}

export function canManageTableReservations(user: PosUser | null | undefined, featureConfig?: PosFeatureConfig | null) {
  if (!isRestaurantAccessEnabled(user, featureConfig ?? undefined) || !isHallMode(featureConfig ?? null)) {
    return false;
  }

  return hasPermission(user, POS_TABLE_RESERVATIONS_MANAGE);
}

export function canAccessCashierBuilder(user: PosUser | null | undefined, featureConfig?: PosFeatureConfig | null) {
  if (!isRestaurantAccessEnabled(user, featureConfig ?? undefined) || !isCashierBuilderMode(featureConfig ?? null)) {
    return false;
  }

  return hasPermission(user, POS_TAKEAWAY_MENU_VIEW);
}

export function canAccessTakeawayBuilder(user: PosUser | null | undefined, featureConfig?: PosFeatureConfig | null) {
  if (!isRestaurantAccessEnabled(user, featureConfig ?? undefined) || !featureConfig?.cashierEnabled) {
    return false;
  }

  return hasPermission(user, POS_TAKEAWAY_MENU_VIEW);
}

export function canAccessCashierPayments(user: PosUser | null | undefined, featureConfig?: PosFeatureConfig | null) {
  if (!isRestaurantAccessEnabled(user, featureConfig ?? undefined) || !featureConfig?.cashierEnabled) {
    return false;
  }

  return hasPermission(user, POS_OPEN_CHECKS_VIEW);
}

export function canManageCashierPayments(user: PosUser | null | undefined, featureConfig?: PosFeatureConfig | null) {
  if (!isRestaurantAccessEnabled(user, featureConfig ?? undefined) || !featureConfig?.cashierEnabled) {
    return false;
  }

  return hasPermission(user, POS_PAYMENTS_CREATE);
}

export function canAccessCashier(user: PosUser | null | undefined, featureConfig?: PosFeatureConfig | null) {
  return canAccessTakeawayBuilder(user, featureConfig) || canAccessCashierPayments(user, featureConfig);
}

export function canAccessKitchen(user: PosUser | null | undefined, featureConfig?: PosFeatureConfig | null) {
  if (
    !isRestaurantAccessEnabled(user, featureConfig ?? undefined) ||
    !featureConfig?.kitchenEnabled ||
    featureConfig.kitchenMode === 'printer'
  ) {
    return false;
  }

  return hasPermission(user, POS_KITCHEN_ORDERS_VIEW);
}

export function canManageKitchenOrders(user: PosUser | null | undefined, featureConfig?: PosFeatureConfig | null) {
  if (
    !isRestaurantAccessEnabled(user, featureConfig ?? undefined) ||
    !featureConfig?.kitchenEnabled ||
    featureConfig.kitchenMode === 'printer'
  ) {
    return false;
  }

  return hasPermission(user, POS_KITCHEN_ORDERS_UPDATE);
}

export function getAccessiblePosSurfaces(session: PosSessionPayload | null | undefined) {
  const user = session?.user;
  const featureConfig = session?.featureConfig ?? null;
  const surfaces = [
    canAccessWaiter(user, featureConfig) ? 'halls' : null,
    canAccessCashier(user, featureConfig) ? 'cashier' : null,
    canAccessKitchen(user, featureConfig) ? 'kitchen' : null,
  ].filter(Boolean) as Array<'halls' | 'cashier' | 'kitchen'>;

  return surfaces;
}

export function shouldShowDock(session: PosSessionPayload | null | undefined) {
  return getAccessiblePosSurfaces(session).length > 1;
}

export function canAccessWaiterTakeaway(user: PosUser | null | undefined, featureConfig?: PosFeatureConfig | null) {
  return canAccessTakeawayBuilder(user, featureConfig);
}

export function getPosHomePath(session: PosSessionPayload | null | undefined) {
  const user = session?.user;
  const featureConfig = session?.featureConfig ?? null;

  if (
    canAccessKitchen(user, featureConfig) &&
    !canAccessWaiter(user, featureConfig) &&
    !canAccessCashier(user, featureConfig)
  ) {
    return '/kitchen/queue';
  }

  if (canAccessCashierBuilder(user, featureConfig)) {
    return '/cashier/builder';
  }

  if (canAccessWaiter(user, featureConfig)) {
    return '/waiter/halls';
  }

  if (canAccessCashierPayments(user, featureConfig)) {
    return '/cashier/open-checks';
  }

  if (canAccessKitchen(user, featureConfig)) {
    return '/kitchen/queue';
  }

  return '/lock-screen';
}
