export type WaiterMenuItem = {
  id: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  image_url?: string | null;
  kind: string;
  prepStationName?: string | null;
  price: number | string;
};

export type WaiterMenuCategory = {
  id: string;
  name: string;
  imageUrl?: string | null;
  image_url?: string | null;
  items: WaiterMenuItem[];
};
