import type { WaiterMenuCategory, WaiterOrder, WaiterOrderItem } from '../entities';

export function getDefaultWaiterMenuCategory(categories: WaiterMenuCategory[]) {
  return categories
    .slice()
    .sort((leftCategory, rightCategory) => rightCategory.items.length - leftCategory.items.length)[0];
}

export function groupWaiterOrderItemsByStation(items: WaiterOrderItem[] | undefined, fallbackLabel: string) {
  const groupMap = new Map<string, WaiterOrderItem[]>();

  for (const item of items ?? []) {
    const groupKey = item.prepStationName ?? fallbackLabel;
    const groupItems = groupMap.get(groupKey) ?? [];
    groupItems.push(item);
    groupMap.set(groupKey, groupItems);
  }

  return Array.from(groupMap.entries());
}

export function getCurrentWaiterOrder(orders: WaiterOrder[] | undefined, sessionId: string | null) {
  return (orders ?? []).find(
    (order) => order.tableSession === sessionId && !['closed', 'cancelled'].includes(order.status),
  );
}

export function getCurrentWaiterTakeawayOrder(orders: WaiterOrder[] | undefined, userId: string | undefined) {
  return (orders ?? []).find(
    (order) =>
      !order.tableSession && order.channel === 'takeaway' && order.status === 'open' && order.openedBy === userId,
  );
}
