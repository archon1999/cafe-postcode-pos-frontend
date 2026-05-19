export type CashierOrderItem = {
  id: string;
  catalogItem: string;
  catalogItemName: string;
  quantity: number | string;
  lineTotal: number | string;
  status: string;
  prepStationName?: string | null;
  note?: string;
  markings?: Array<{
    id: string;
    rawCode?: string;
    raw_code?: string;
    gtin?: string;
    serial?: string;
    scannedAt?: string;
    scanned_at?: string;
  }>;
  markingRequiredCount?: number;
  marking_required_count?: number;
  markingScannedCount?: number;
  marking_scanned_count?: number;
};

export type CashierCheckStatus = 'open' | 'closed' | 'fiscal_unresolved';

export type CashierOrder = {
  id: string;
  openedBy?: string | null;
  openedByName?: string | null;
  orderNumber: number;
  displayName?: string | null;
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
    registerFiscal?: boolean;
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
    fiscalRequestedAt?: string | null;
    fiscalRegisteredAt?: string | null;
    originalPaidAt?: string | null;
    fiscalErrorCode?: string | null;
    fiscalErrorMessage?: string | null;
    payload?: Record<string, unknown> | null;
    createdAt?: string;
  }>;
};

export type CashierCreateOrderResponse = {
  id: string;
};
