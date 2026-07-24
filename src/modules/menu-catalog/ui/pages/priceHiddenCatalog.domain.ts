import type { KeyboardEvent } from 'react';

import type { CashierBuilderOrderChannel } from 'modules/cashier/domain';
import { resolveApiBaseUrl } from 'shared/api/apiUrl';
import type { PosModifierGroup, PosOrderItemModifier } from 'shared/pos/modifiers';
import { orderItemModifierSignature } from 'shared/pos/modifiers';

export type CatalogMenuItemLike = {
  id: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  prepStationName?: string | null;
  price: number | string;
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
  status: string;
  note?: string | null;
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

    const count = Number(item.quantity ?? 0);
    countMap.set(item.catalogItem, (countMap.get(item.catalogItem) ?? 0) + count);
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
      existing.quantity += Number(item.quantity ?? 0);
      existing.itemIds.push(item.id);
      continue;
    }

    itemMap.set(aggregationKey, {
      key: aggregationKey,
      catalogItem: item.catalogItem,
      catalogItemName: item.catalogItemName,
      quantity: Number(item.quantity ?? 0),
      status: item.status,
      note: item.note,
      itemIds: [item.id],
    });
  }

  return Array.from(itemMap.values()).filter((item) => item.status !== 'cancelled');
}
