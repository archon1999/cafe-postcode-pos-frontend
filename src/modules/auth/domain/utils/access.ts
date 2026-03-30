import type { PosFeatureConfig, PosSessionPayload, PosUser } from '../entities';

export function hasPermission(user: PosUser | null | undefined, permissionCode: string) {
  return Boolean(user?.permissionCodes?.includes(permissionCode));
}

function hasAnyPermission(user: PosUser | null | undefined, permissionCodes: string[]) {
  return permissionCodes.some((permissionCode) => hasPermission(user, permissionCode));
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

export function isHallMode(featureConfig: PosFeatureConfig) {
  return Boolean(featureConfig?.hallEnabled && featureConfig?.orderEntryMode === 'hall');
}

export function isCashierBuilderMode(featureConfig: PosFeatureConfig) {
  return Boolean(featureConfig?.cashierEnabled && featureConfig?.orderEntryMode === 'cashier_builder');
}

export function canAccessWaiter(user: PosUser | null | undefined, featureConfig?: PosFeatureConfig) {
  if (!isRestaurantAccessEnabled(user, featureConfig) || !isHallMode(featureConfig ?? null)) {
    return false;
  }

  return hasAnyPermission(user, [
    'hall.view',
    'hall.manage',
    'table.manage',
    'orders.create',
    'orders.view',
    'orders.manage',
  ]);
}

export function canAccessCashier(user: PosUser | null | undefined, featureConfig?: PosFeatureConfig) {
  if (!isRestaurantAccessEnabled(user, featureConfig) || !featureConfig?.cashierEnabled) {
    return false;
  }

  return hasAnyPermission(user, [
    'payments.create',
    'payments.view',
    'payments.manage',
    'cashshift.view',
    'cashshift.open',
    'cashshift.close',
    'receipt.reprint',
    'payment.refund',
  ]);
}

export function canAccessKitchen(user: PosUser | null | undefined, featureConfig?: PosFeatureConfig) {
  if (!isRestaurantAccessEnabled(user, featureConfig) || !featureConfig?.kitchenEnabled || featureConfig.kitchenMode === 'printer') {
    return false;
  }

  return hasAnyPermission(user, [
    'kitchen.view',
    'kitchen.update',
    'kitchen.manage',
    'stoplist.manage',
  ]);
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

export function canAccessWaiterTakeaway(user: PosUser | null | undefined, featureConfig?: PosFeatureConfig) {
  return isCashierBuilderMode(featureConfig ?? null) && canAccessCashier(user, featureConfig);
}

export function canAccessCashierBuilder(user: PosUser | null | undefined, featureConfig?: PosFeatureConfig) {
  return isCashierBuilderMode(featureConfig ?? null) && canAccessCashier(user, featureConfig);
}

export function canAccessCashierPayments(user: PosUser | null | undefined, featureConfig?: PosFeatureConfig) {
  return canAccessCashier(user, featureConfig);
}

export function getPosHomePath(session: PosSessionPayload | null | undefined) {
  const user = session?.user;
  const featureConfig = session?.featureConfig ?? null;

  if (canAccessKitchen(user, featureConfig) && !canAccessWaiter(user, featureConfig) && !canAccessCashier(user, featureConfig)) {
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
