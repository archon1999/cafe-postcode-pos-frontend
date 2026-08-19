import type { PosModifierSelection, PosOrderItemModifier } from './modifiers';
import { modifierPriceDelta, orderItemModifierSignature, selectedModifierOptions } from './modifiers';
import type { PosServiceFeeComponent } from './service-fees';

export type BuilderMenuItemLike = {
  id: string;
  name: string;
  prepStationName?: string | null;
  price: number | string;
  itemType?: 'product' | 'service';
  saleUnit?: 'piece' | 'kg';
  modifierGroups?: import('./modifiers').PosModifierGroup[];
};

export type BuilderOrderItemLike = {
  id: string;
  catalogItem: string;
  catalogItemName: string;
  quantity: number | string;
  saleUnit?: 'piece' | 'kg';
  lineTotal: number | string;
  status: string;
  prepStationName?: string | null;
  note?: string | null;
  modifiers?: PosOrderItemModifier[];
};

export type BuilderOrderLike<TItem extends BuilderOrderItemLike = BuilderOrderItemLike> = {
  id: string;
  orderNumber: number;
  status: string;
  subtotal: number | string;
  serviceFee: number | string;
  serviceFeeEnabled?: boolean;
  serviceFeePercent?: number | string;
  serviceFeeComponents?: PosServiceFeeComponent[];
  vatEnabled?: boolean;
  vatPercent?: number | string;
  vatAmount?: number | string;
  total: number | string;
  note: string;
  channel: string;
  items: TItem[];
};

export type PendingAddOperation<TMenuItem extends BuilderMenuItemLike> = {
  opId: string;
  tempItemId: string;
  menuItem: TMenuItem;
  note: string;
  selectedModifiers?: PosModifierSelection[];
  manualPrice?: number;
  quantity?: number;
  canceled: boolean;
};

export type PendingRemoveOperation = {
  opId: string;
  itemId: string;
};

type DeriveOptimisticBuilderOrderOptions<
  TMenuItem extends BuilderMenuItemLike,
  TItem extends BuilderOrderItemLike,
  TOrder extends BuilderOrderLike<TItem>,
> = {
  baseOrder?: TOrder;
  channel: string;
  defaultServiceFeeEnabled?: boolean;
  defaultServiceFeePercent: number;
  defaultServiceFeeComponents?: PosServiceFeeComponent[];
  defaultVatEnabled?: boolean;
  defaultVatPercent?: number | string;
  pendingAdds: PendingAddOperation<TMenuItem>[];
  pendingRemoves: PendingRemoveOperation[];
  tempOrderId?: string | null;
};

const TEMP_ID_PREFIX = 'temp-builder-';

export function createTemporaryBuilderId() {
  return `${TEMP_ID_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function isTemporaryBuilderId(value: string) {
  return value.startsWith(TEMP_ID_PREFIX);
}

export function toMoneyNumber(value: number | string | undefined | null) {
  const normalized = Number(value ?? 0);
  return Number.isFinite(normalized) ? normalized : 0;
}

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

function includedVatAmount(total: number, vatPercent: number) {
  if (total <= 0 || vatPercent <= 0) {
    return 0;
  }

  return Math.round((total * vatPercent) / (100 + vatPercent));
}

function createOptimisticItem<TMenuItem extends BuilderMenuItemLike, TItem extends BuilderOrderItemLike>(
  operation: PendingAddOperation<TMenuItem>,
): TItem {
  const modifierGroups = operation.menuItem.modifierGroups ?? [];
  const modifierDelta = modifierPriceDelta(modifierGroups, operation.selectedModifiers ?? []);
  const modifiers = selectedModifierOptions(modifierGroups, operation.selectedModifiers ?? []).map(
    ({ group, option }, index) => ({
      optionId: option.id,
      groupName: group.name,
      optionName: option.name,
      priceDelta: option.priceDelta,
      sortOrder: index,
    }),
  );
  const baseUnitPrice = operation.manualPrice ?? toMoneyNumber(operation.menuItem.price);
  const unitPrice = baseUnitPrice + modifierDelta;

  const quantity = Math.max(operation.menuItem.saleUnit === 'kg' ? 0.001 : 1, Number(operation.quantity ?? 1));
  return {
    id: operation.tempItemId,
    catalogItem: operation.menuItem.id,
    catalogItemName: operation.menuItem.name,
    quantity,
    saleUnit: operation.menuItem.saleUnit ?? 'piece',
    baseUnitPrice,
    unitPrice,
    lineTotal: Math.round(unitPrice * quantity),
    status: 'new',
    prepStationName: operation.menuItem.prepStationName,
    note: operation.note || undefined,
    modifiers,
  } as unknown as TItem;
}

export function deriveOptimisticBuilderOrder<
  TMenuItem extends BuilderMenuItemLike,
  TItem extends BuilderOrderItemLike,
  TOrder extends BuilderOrderLike<TItem>,
>(options: DeriveOptimisticBuilderOrderOptions<TMenuItem, TItem, TOrder>) {
  const {
    baseOrder,
    channel,
    defaultServiceFeeEnabled,
    defaultServiceFeePercent,
    defaultServiceFeeComponents,
    defaultVatEnabled = false,
    defaultVatPercent = 0,
    pendingAdds,
    pendingRemoves,
    tempOrderId,
  } = options;
  const removedItemIds = new Set(pendingRemoves.map((operation) => operation.itemId));
  const visibleBaseItems = (baseOrder?.items ?? []).filter((item) => !removedItemIds.has(item.id));
  const visiblePendingItems = pendingAdds.filter((operation) => !operation.canceled).map(createOptimisticItem);
  const items = [...visibleBaseItems, ...visiblePendingItems];

  if (!baseOrder && items.length === 0) {
    return undefined;
  }

  const vatEnabled = Boolean(baseOrder?.vatEnabled ?? defaultVatEnabled);
  const vatPercent = toMoneyNumber(baseOrder?.vatPercent ?? defaultVatPercent);
  const subtotal = roundMoney(
    items.reduce((sum, item) => {
      if (item.status === 'cancelled') {
        return sum;
      }

      return sum + toMoneyNumber(item.lineTotal);
    }, 0),
  );
  const configuredServiceFeeComponents = baseOrder?.serviceFeeComponents ?? defaultServiceFeeComponents;
  const legacyServiceFeeEnabled = Boolean(
    baseOrder?.serviceFeeEnabled ?? defaultServiceFeeEnabled ?? defaultServiceFeePercent > 0,
  );
  const legacyServiceFeePercent = legacyServiceFeeEnabled
    ? toMoneyNumber(baseOrder?.serviceFeePercent ?? defaultServiceFeePercent)
    : 0;
  const sourceServiceFeeComponents = configuredServiceFeeComponents?.length
    ? configuredServiceFeeComponents
    : legacyServiceFeePercent > 0
      ? [{ scope: 'restaurant' as const, percent: legacyServiceFeePercent }]
      : [];
  const serviceFeeComponents = sourceServiceFeeComponents
    .filter((component) => toMoneyNumber(component.percent) > 0)
    .map((component) => ({
      ...component,
      percent: toMoneyNumber(component.percent),
      amount: Math.round((subtotal * toMoneyNumber(component.percent)) / 100),
    }));
  const serviceFeePercent = serviceFeeComponents.reduce((sum, component) => sum + toMoneyNumber(component.percent), 0);
  const serviceFee = serviceFeeComponents.reduce((sum, component) => sum + toMoneyNumber(component.amount), 0);
  const serviceFeeEnabled = serviceFeeComponents.length > 0;
  const total = roundMoney(subtotal + serviceFee);
  const vatAmount = vatEnabled ? includedVatAmount(total, vatPercent) : 0;

  if (baseOrder) {
    return {
      ...baseOrder,
      items,
      subtotal,
      serviceFee,
      serviceFeeEnabled,
      serviceFeePercent,
      serviceFeeComponents,
      vatEnabled,
      vatPercent: vatEnabled ? vatPercent : 0,
      vatAmount,
      total,
    } as TOrder;
  }

  return {
    id: tempOrderId ?? createTemporaryBuilderId(),
    orderNumber: 0,
    status: 'open',
    subtotal,
    serviceFee,
    serviceFeeEnabled,
    serviceFeePercent,
    serviceFeeComponents,
    vatEnabled,
    vatPercent: vatEnabled ? vatPercent : 0,
    vatAmount,
    total,
    note: '',
    channel,
    items,
  } as TOrder;
}

export function findLatestOrderItem<TItem extends BuilderOrderItemLike>(
  items: TItem[] | undefined,
  params: { catalogItemId: string; note: string; modifiers?: PosOrderItemModifier[] },
) {
  const expectedNote = params.note || '';
  const expectedModifiers = orderItemModifierSignature(params.modifiers);

  for (let index = (items?.length ?? 0) - 1; index >= 0; index -= 1) {
    const item = items?.[index];

    if (!item || item.status === 'cancelled') {
      continue;
    }

    if (
      item.catalogItem === params.catalogItemId &&
      (item.note ?? '') === expectedNote &&
      orderItemModifierSignature(item.modifiers) === expectedModifiers
    ) {
      return item;
    }
  }

  return undefined;
}
