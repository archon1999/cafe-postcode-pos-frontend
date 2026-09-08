import type { SaleUnit } from 'shared/domain/sale-units';
import type { PosInventoryAvailability } from 'shared/pos/inventory';
import type { PosModifierGroup } from 'shared/pos/modifiers';

export type WaiterMenuItem = {
  inventory?: PosInventoryAvailability;
  id: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  kind: string;
  prepStationName?: string | null;
  price: number | string;
  itemType?: 'product' | 'service';
  saleUnit?: SaleUnit;
  modifierGroups?: PosModifierGroup[];
};

export type WaiterMenuCategory = {
  id: string;
  name: string;
  imageUrl?: string | null;
  items: WaiterMenuItem[];
  itemGroups?: WaiterMenuItemGroup[];
};

export type WaiterMenuItemGroupMember = {
  id: string;
  variantName: string;
  sortOrder: number;
  item: WaiterMenuItem;
};

export type WaiterMenuItemGroup = {
  id: string;
  name: string;
  description?: string | null;
  sortOrder: number;
  members: WaiterMenuItemGroupMember[];
};
