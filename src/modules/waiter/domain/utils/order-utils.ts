import { orderItemModifierSignature } from 'shared/pos/modifiers';
import { addPosQuantities, normalizePosQuantity } from 'shared/pos/utils';

import type { WaiterMenuCategory, WaiterOrder, WaiterOrderItem } from '../entities';

export type AggregatedWaiterCartItem = {
  key: string;
  id: string;
  catalogItem: string;
  catalogItemName: string;
  note?: string | null;
  quantity: number;
  saleUnit?: 'piece' | 'kg';
  lineTotal: number;
  status: string;
  itemIds: string[];
  modifiers?: WaiterOrderItem['modifiers'];
};

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

export function aggregateWaiterCartItemsByStation(items: WaiterOrderItem[] | undefined, fallbackLabel: string) {
  return groupWaiterOrderItemsByStation(items, fallbackLabel).map(([stationName, stationItems]) => {
    const itemMap = new Map<string, AggregatedWaiterCartItem>();

    for (const item of stationItems) {
      const modifierSignature = orderItemModifierSignature(item.modifiers);
      const key = [
        item.catalogItem,
        item.note ?? '',
        ...(modifierSignature ? [modifierSignature] : []),
        item.status,
        item.prepStationName ?? stationName,
      ].join('::');
      const existing = itemMap.get(key);
      if (existing) {
        existing.quantity = addPosQuantities(existing.quantity, item.quantity);
        existing.lineTotal += Number(item.lineTotal ?? 0);
        existing.itemIds.push(item.id);
        existing.id = item.id;
        continue;
      }

      itemMap.set(key, {
        key,
        id: item.id,
        catalogItem: item.catalogItem,
        catalogItemName: item.catalogItemName,
        note: item.note,
        quantity: normalizePosQuantity(item.quantity),
        saleUnit: item.saleUnit ?? 'piece',
        lineTotal: Number(item.lineTotal ?? 0),
        status: item.status,
        itemIds: [item.id],
        ...(item.modifiers?.length ? { modifiers: item.modifiers } : {}),
      });
    }

    return [stationName, Array.from(itemMap.values())] as const;
  });
}

export function getWaiterOrderItemMeta(items: WaiterOrderItem[] | undefined) {
  const countMap = new Map<string, number>();
  const latestItemMap = new Map<string, string>();

  for (const item of items ?? []) {
    if (item.status === 'cancelled') {
      continue;
    }
    countMap.set(item.catalogItem, addPosQuantities(countMap.get(item.catalogItem), item.quantity));
    latestItemMap.set(item.catalogItem, item.id);
  }

  return { countMap, latestItemMap };
}

export function formatWaiterOrderLabel(order: Pick<WaiterOrder, 'orderNumber' | 'displayName'> | null | undefined) {
  if (!order) {
    return 'ID 0';
  }
  const displayName = order.displayName?.trim();
  if (displayName) {
    return /^\d+$/.test(displayName) ? `#${displayName}` : displayName;
  }
  return `ID ${Number(order.orderNumber || 0)}`;
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
