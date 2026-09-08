import type { KeyboardEvent } from 'react';

import type { CashierBuilderOrderChannel } from 'modules/cashier/domain';
import { resolveApiBaseUrl } from 'shared/api/apiUrl';
import type { SaleUnit } from 'shared/domain/sale-units';
import type { PosInventoryAvailability } from 'shared/pos/inventory';
import type { PosModifierGroup, PosOrderItemModifier } from 'shared/pos/modifiers';
import { orderItemModifierSignature } from 'shared/pos/modifiers';
import { addPosQuantities, normalizePosQuantity } from 'shared/pos/utils';

export type CatalogMenuItemLike = {
  inventory?: PosInventoryAvailability;
  id: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  prepStationName?: string | null;
  price: number | string;
  saleUnit?: SaleUnit;
  modifierGroups?: PosModifierGroup[];
};

export type CatalogCategoryLike<TMenuItem extends CatalogMenuItemLike> = {
  id: string;
  name: string;
  imageUrl?: string | null;
  items: TMenuItem[];
};

export type CatalogOrderItemLike = {
  id: string;
  catalogItem: string;
  catalogItemName: string;
  quantity: number | string;
  saleUnit?: SaleUnit;
  status: string;
  prepStationName?: string | null;
  note?: string | null;
  modifiers?: PosOrderItemModifier[];
};

export type CatalogSummaryItem = {
  key: string;
  catalogItem: string;
  catalogItemName: string;
  quantity: number;
  saleUnit?: SaleUnit;
  status: string;
  note?: string | null;
  modifiers?: PosOrderItemModifier[];
  itemIds: string[];
};

export function resolveBuilderChannel(value: string | null): CashierBuilderOrderChannel {
  return value === 'delivery' || value === 'takeaway' ? value : 'hall';
}

export function getDefaultCategory<TMenuItem extends CatalogMenuItemLike>(
  categories: CatalogCategoryLike<TMenuItem>[],
) {
  return categories
    .slice()
    .sort((leftCategory, rightCategory) => rightCategory.items.length - leftCategory.items.length)[0];
}

function resolveImageUrl(imageUrl?: string | null) {
  if (!imageUrl) {
    return null;
  }

  try {
    return new URL(imageUrl, resolveApiBaseUrl()).toString();
  } catch {
    return imageUrl;
  }
}

export function resolveMenuItemImageUrl(menuItem: CatalogMenuItemLike) {
  return resolveImageUrl(menuItem.imageUrl);
}

export function resolveCategoryImageUrl<TMenuItem extends CatalogMenuItemLike>(
  category: CatalogCategoryLike<TMenuItem>,
) {
  const categoryImageUrl = resolveImageUrl(category.imageUrl);
  if (categoryImageUrl) {
    return categoryImageUrl;
  }

  for (const menuItem of category.items) {
    const menuItemImageUrl = resolveMenuItemImageUrl(menuItem);
    if (menuItemImageUrl) {
      return menuItemImageUrl;
    }
  }

  return null;
}

export function createActionKeyHandler(onActivate: () => void) {
  return (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    onActivate();
  };
}

export function buildOrderItemMeta(items: CatalogOrderItemLike[] | undefined) {
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

export function aggregateSummaryItems(items: CatalogOrderItemLike[] | undefined, fallbackStationName: string) {
  const itemMap = new Map<string, CatalogSummaryItem>();

  for (const item of items ?? []) {
    const modifierSignature = orderItemModifierSignature(item.modifiers);
    const aggregationKey = [
      item.catalogItem,
      item.note ?? '',
      ...(modifierSignature ? [modifierSignature] : []),
      item.status,
      item.prepStationName ?? fallbackStationName,
    ].join('::');
    const existing = itemMap.get(aggregationKey);

    if (existing) {
      existing.quantity = addPosQuantities(existing.quantity, item.quantity);
      existing.itemIds.push(item.id);
      continue;
    }

    itemMap.set(aggregationKey, {
      key: aggregationKey,
      catalogItem: item.catalogItem,
      catalogItemName: item.catalogItemName,
      quantity: normalizePosQuantity(item.quantity),
      saleUnit: item.saleUnit ?? 'piece',
      status: item.status,
      note: item.note,
      modifiers: item.modifiers,
      itemIds: [item.id],
    });
  }

  return Array.from(itemMap.values()).filter((item) => item.status !== 'cancelled');
}
