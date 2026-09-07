import type { PosInventoryAvailability } from 'shared/pos/inventory';
import type { PosModifierGroup } from 'shared/pos/modifiers';

export type CashierMenuItem = {
  inventory?: PosInventoryAvailability;
  id: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  kind: string;
  prepStationName?: string | null;
  price: number | string;
  itemType?: 'product' | 'service';
  saleUnit?: 'piece' | 'kg';
  requiresMarking?: boolean;
  markingGtin?: string | null;
  modifierGroups?: PosModifierGroup[];
};

export type CashierMenuCategory = {
  id: string;
  name: string;
  imageUrl?: string | null;
  items: CashierMenuItem[];
  itemGroups?: CashierMenuItemGroup[];
};

export type CashierMenuItemGroupMember = {
  id: string;
  variantName: string;
  sortOrder: number;
  item: CashierMenuItem;
};

export type CashierMenuItemGroup = {
  id: string;
  name: string;
  description?: string | null;
  sortOrder: number;
  members: CashierMenuItemGroupMember[];
};
