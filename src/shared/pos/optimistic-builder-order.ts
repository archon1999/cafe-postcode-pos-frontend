export type BuilderMenuItemLike = {
  id: string;
  name: string;
  prepStationName?: string | null;
  price: number | string;
};

export type BuilderOrderItemLike = {
  id: string;
  catalogItem: string;
  catalogItemName: string;
  quantity: number | string;
  lineTotal: number | string;
  status: string;
  prepStationName?: string | null;
  note?: string | null;
};

export type BuilderOrderLike<TItem extends BuilderOrderItemLike = BuilderOrderItemLike> = {
  id: string;
  orderNumber: number;
  status: string;
  subtotal: number | string;
  serviceFee: number | string;
  serviceFeeEnabled?: boolean;
  serviceFeePercent?: number | string;
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
  return {
    id: operation.tempItemId,
    catalogItem: operation.menuItem.id,
    catalogItemName: operation.menuItem.name,
    quantity: 1,
    lineTotal: toMoneyNumber(operation.menuItem.price),
    status: 'new',
    prepStationName: operation.menuItem.prepStationName,
    note: operation.note || undefined,
  } as TItem;
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

  const serviceFeeEnabled = Boolean(
    baseOrder?.serviceFeeEnabled ?? defaultServiceFeeEnabled ?? defaultServiceFeePercent > 0,
  );
  const serviceFeePercent = serviceFeeEnabled
    ? toMoneyNumber(baseOrder?.serviceFeePercent ?? defaultServiceFeePercent)
    : 0;
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
  const serviceFee = roundMoney((subtotal * serviceFeePercent) / 100);
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
  params: { catalogItemId: string; note: string },
) {
  const expectedNote = params.note || '';

  for (let index = (items?.length ?? 0) - 1; index >= 0; index -= 1) {
    const item = items?.[index];

    if (!item || item.status === 'cancelled') {
      continue;
    }

    if (item.catalogItem === params.catalogItemId && (item.note ?? '') === expectedNote) {
      return item;
    }
  }

  return undefined;
}
