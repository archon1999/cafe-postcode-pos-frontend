import type { PosModifierGroup } from 'shared/pos/modifiers';

export type WaiterMenuItem = {
  id: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  kind: string;
  prepStationName?: string | null;
  price: number | string;
  itemType?: 'product' | 'service';
  saleUnit?: 'piece' | 'kg';
  modifierGroups?: PosModifierGroup[];
};

export type WaiterMenuCategory = {
  id: string;
  name: string;
  imageUrl?: string | null;
  items: WaiterMenuItem[];
};
