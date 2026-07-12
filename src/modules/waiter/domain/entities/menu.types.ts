export type WaiterMenuItem = {
  id: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  kind: string;
  prepStationName?: string | null;
  price: number | string;
};

export type WaiterMenuCategory = {
  id: string;
  name: string;
  imageUrl?: string | null;
  items: WaiterMenuItem[];
};
