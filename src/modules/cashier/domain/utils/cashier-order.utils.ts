import type { CashierMenuCategory, CashierOrder, CashierOrderItem } from '../entities';

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

export function getCurrentCashierBuilderOrder(orders: CashierOrder[] | undefined, userId: string | undefined) {
  return (orders ?? []).find(
    (order) =>
      !order.tableSession &&
      order.channel === 'takeaway' &&
      order.status === 'open' &&
      order.openedBy === userId,
  );
}
