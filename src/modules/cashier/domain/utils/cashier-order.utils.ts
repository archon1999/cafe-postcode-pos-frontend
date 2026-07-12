import type { CashierBuilderOrderChannel, CashierMenuCategory, CashierOrder, CashierOrderItem } from '../entities';

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

export function aggregateCashierOrderItems(items: CashierOrderItem[] | undefined) {
  const aggregatedItemMap = new Map<
    string,
    CashierOrderItem & {
      key: string;
    }
  >();

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
