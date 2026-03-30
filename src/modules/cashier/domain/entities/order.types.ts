export type CashierOrderItem = {
  id: string;
  catalogItem: string;
  catalogItemName: string;
  quantity: number | string;
  lineTotal: number | string;
  status: string;
  prepStationName?: string | null;
  note?: string;
};

export type CashierOrder = {
  id: string;
  openedBy?: string | null;
  openedByName?: string | null;
  orderNumber: number;
  status: string;
  subtotal: number | string;
  serviceFee: number | string;
  serviceFeePercent?: number | string;
  total: number | string;
  note: string;
  channel: string;
  items: CashierOrderItem[];
  tableSession?: string | null;
  tableName?: string | null;
  hallName?: string | null;
  guestCount?: number;
  createdAt?: string;
  closedAt?: string | null;
  cashierName?: string | null;
  payments?: Array<{
    id: string;
    amount: number | string;
    status: string;
    method: 'cash' | 'card' | 'qr' | 'mixed';
    refundsTotal?: number | string;
    isRefunded?: boolean;
    paidAt?: string | null;
  }>;
  receipts?: Array<{
    id: string;
    status: string;
    kind?: 'prebill' | 'fiscal' | 'refund';
    reprintCount?: number;
    lastReprintedAt?: string | null;
    payload?: Record<string, unknown> | null;
    createdAt?: string;
  }>;
};

export type CashierCreateOrderResponse = {
  id: string;
};
