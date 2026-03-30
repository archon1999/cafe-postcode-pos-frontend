export type WaiterOrderItem = {
  id: string;
  catalogItem: string;
  catalogItemName: string;
  quantity: number | string;
  lineTotal: number | string;
  status: string;
  prepStationName?: string | null;
  note?: string;
};

export type WaiterOrder = {
  id: string;
  tableSession: string | null;
  openedBy?: string;
  orderNumber: number;
  status: string;
  subtotal: number | string;
  serviceFee: number | string;
  serviceFeePercent?: number | string;
  total: number | string;
  note: string;
  channel: string;
  items: WaiterOrderItem[];
};

export type WaiterCreateOrderResponse = {
  id: string;
};
