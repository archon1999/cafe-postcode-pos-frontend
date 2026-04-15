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

export type WaiterQzPrintJob = {
  type: 'qz-tray';
  format: 'raw';
  language?: 'escpos' | string;
  flavor: 'hex' | 'base64';
  data: string;
  encoding?: string;
  config: {
    connectionType?: 'system_printer' | 'socket';
    connection_type?: 'system_printer' | 'socket';
    printerName?: string;
    printer_name?: string;
    host?: string;
    port?: number | string;
  };
};

export type WaiterPrintPrebillResult = {
  ok?: boolean;
  provider?: string;
  mode?: string;
  detail?: string;
  requiresClientPrint?: boolean;
  requires_client_print?: boolean;
  printJob?: WaiterQzPrintJob;
  print_job?: WaiterQzPrintJob;
  [key: string]: unknown;
};

export type WaiterPrintPrebillResponse = {
  receipt: WaiterReceipt | null;
  result: WaiterPrintPrebillResult;
};
