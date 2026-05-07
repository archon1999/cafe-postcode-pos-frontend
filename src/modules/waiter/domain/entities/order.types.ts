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
  vatEnabled?: boolean;
  vatPercent?: number | string;
  vatAmount?: number | string;
  total: number | string;
  note: string;
  channel: string;
  items: WaiterOrderItem[];
};

export type WaiterReceipt = {
  id: string;
  status: string;
  kind?: 'prebill' | 'fiscal' | 'refund';
  reprintCount?: number;
  lastReprintedAt?: string | null;
  payload?: Record<string, unknown> | null;
  createdAt?: string;
};

export type WaiterCreateOrderResponse = {
  id: string;
};

export type WaiterPrintPrebillResult = {
  ok?: boolean;
  provider?: string;
  code?: string;
  detail?: string;
  requiresClientPrint?: boolean;
  requires_client_print?: boolean;
  [key: string]: unknown;
};

export type WaiterPrintPrebillResponse = {
  receipt: WaiterReceipt | null;
  result: WaiterPrintPrebillResult;
};
