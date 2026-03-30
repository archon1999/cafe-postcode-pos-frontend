export type WaiterMenuItem = {
  id: string;
  name: string;
  kind: string;
  prepStationName?: string | null;
  price: number | string;
};

export type WaiterMenuCategory = {
  id: string;
  name: string;
  items: WaiterMenuItem[];
};
