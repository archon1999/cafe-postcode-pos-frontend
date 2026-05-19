export type CashierMenuItem = {
  id: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  kind: string;
  prepStationName?: string | null;
  price: number | string;
  requiresMarking?: boolean;
  markingGtin?: string | null;
};

export type CashierMenuCategory = {
  id: string;
  name: string;
  items: CashierMenuItem[];
};
