import type { CashierBuilderOrderChannel, CashierMenuCategory, CashierOrder, CashierOrderItem } from '../entities';

export type AggregatedCashierCartItem = {
  key: string;
  id: string;
  catalogItem: string;
  catalogItemName: string;
  note?: string | null;
  quantity: number;
  lineTotal: number;
  status: string;
  itemIds: string[];
  markingRequiredCount: number;
  markingScannedCount: number;
  markingMissingCount: number;
};

export type AggregatedCashierOrderItem = CashierOrderItem & {
  key: string;
};

export function getDefaultCashierMenuCategory(categories: CashierMenuCategory[]) {
  return categories
    .slice()
    .sort((leftCategory, rightCategory) => rightCategory.items.length - leftCategory.items.length)[0];
}

export function groupCashierOrderItemsByStation(items: CashierOrderItem[] | undefined, fallbackLabel: string) {
  const groupMap = new Map<string, CashierOrderItem[]>();

  for (const item of items ?? []) {
    const groupKey = item.prepStationName ?? fallbackLabel;
    const groupItems = groupMap.get(groupKey) ?? [];
    groupItems.push(item);
    groupMap.set(groupKey, groupItems);
  }

  return Array.from(groupMap.entries());
}

function getCashierOrderItemMarkingRequiredCount(item: CashierOrderItem) {
  return Number(item.markingRequiredCount ?? 0);
}

function getCashierOrderItemMarkingScannedCount(item: CashierOrderItem) {
  return Number(item.markingScannedCount ?? item.markings?.length ?? 0);
}

export function getCashierOrderItemsTotalQuantity(items: CashierOrderItem[] | undefined) {
  return (items ?? []).reduce((sum, item) => sum + Number(item.quantity ?? 0), 0);
}

export function getCashierOrderMissingMarkingCount(items: CashierOrderItem[] | undefined) {
  return (items ?? []).reduce((sum, item) => {
    const required = getCashierOrderItemMarkingRequiredCount(item);
    const scanned = getCashierOrderItemMarkingScannedCount(item);
    return sum + Math.max(required - scanned, 0);
  }, 0);
}

export function aggregateCashierCartItemsByStation(items: CashierOrderItem[] | undefined, fallbackLabel: string) {
  return groupCashierOrderItemsByStation(items, fallbackLabel).map(([stationName, stationItems]) => {
    const aggregatedMap = new Map<string, AggregatedCashierCartItem>();

    for (const item of stationItems) {
      const markingRequiredCount = getCashierOrderItemMarkingRequiredCount(item);
      const markingScannedCount = getCashierOrderItemMarkingScannedCount(item);
      const markingMissingCount = Math.max(markingRequiredCount - markingScannedCount, 0);
      const aggregationKey = [item.catalogItem, item.note ?? '', item.status, item.prepStationName ?? stationName].join(
        '::',
      );
      const existing = aggregatedMap.get(aggregationKey);

      if (existing) {
        existing.quantity += Number(item.quantity ?? 0);
        existing.lineTotal += Number(item.lineTotal ?? 0);
        existing.itemIds.push(item.id);
        existing.id = item.id;
        existing.markingRequiredCount += markingRequiredCount;
        existing.markingScannedCount += markingScannedCount;
        existing.markingMissingCount += markingMissingCount;
        continue;
      }

      aggregatedMap.set(aggregationKey, {
        key: aggregationKey,
        id: item.id,
        catalogItem: item.catalogItem,
        catalogItemName: item.catalogItemName,
        note: item.note,
        quantity: Number(item.quantity ?? 0),
        lineTotal: Number(item.lineTotal ?? 0),
        status: item.status,
        itemIds: [item.id],
        markingRequiredCount,
        markingScannedCount,
        markingMissingCount,
      });
    }

    return [stationName, Array.from(aggregatedMap.values())] as const;
  });
}

export function aggregateCashierOrderItems(items: CashierOrderItem[] | undefined) {
  const aggregatedItemMap = new Map<string, AggregatedCashierOrderItem>();

  for (const item of items ?? []) {
    const statusGroup = item.status === 'cancelled' ? 'cancelled' : 'active';
    const aggregationKey = [item.catalogItem, item.note ?? '', statusGroup, item.prepStationName ?? ''].join('::');
    const existing = aggregatedItemMap.get(aggregationKey);

    if (existing) {
      existing.quantity = Number(existing.quantity ?? 0) + Number(item.quantity ?? 0);
      existing.lineTotal = Number(existing.lineTotal ?? 0) + Number(item.lineTotal ?? 0);
      continue;
    }

    aggregatedItemMap.set(aggregationKey, {
      ...item,
      quantity: Number(item.quantity ?? 0),
      lineTotal: Number(item.lineTotal ?? 0),
      key: aggregationKey,
    });
  }

  return Array.from(aggregatedItemMap.values());
}

export function getCashierOrderNumberLabel(order: Pick<CashierOrder, 'orderNumber'>) {
  return `ID ${Number(order.orderNumber || 0)}`;
}

export function getCashierOrderDisplayName(order: Pick<CashierOrder, 'orderNumber' | 'displayName'>) {
  const normalizedDisplayName = order.displayName?.trim();
  if (!normalizedDisplayName) {
    return getCashierOrderNumberLabel(order);
  }
  return /^\d+$/.test(normalizedDisplayName) ? `#${normalizedDisplayName}` : normalizedDisplayName;
}

export function getCurrentCashierBuilderOrder(
  orders: CashierOrder[] | undefined,
  userId: string | undefined,
  channel?: CashierBuilderOrderChannel,
) {
  return (orders ?? []).find(
    (order) =>
      !order.tableSession &&
      (!channel || order.channel === channel) &&
      order.status === 'open' &&
      order.openedBy === userId,
  );
}
