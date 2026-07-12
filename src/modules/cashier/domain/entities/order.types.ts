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
    gtin?: string;
    serial?: string;
    scannedAt?: string;
  }>;
  markingRequiredCount?: number;
  markingScannedCount?: number;
};

export type CashierCheckStatus = 'open' | 'closed' | 'fiscal_closed';
export type CashierBuilderOrderChannel = 'delivery' | 'hall' | 'takeaway';

export type CashierOrder = {
  id: string;
  openedBy?: string | null;
  openedByName?: string | null;
  orderNumber: number;
  displayName?: string | null;
  status: string;
  subtotal: number | string;
  serviceFee: number | string;
  serviceFeeEnabled?: boolean;
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
  deliveryPhone?: string | null;
  deliveryAddress?: string | null;
  createdAt?: string;
  closedAt?: string | null;
  cashierName?: string | null;
  payments?: Array<{
    id: string;
    amount: number | string;
    status: string;
    method: 'cash' | 'card' | 'qr' | 'mixed';
    cashAmount?: number | string;
    cardAmount?: number | string;
    fiscalCashAmount?: number | string;
    fiscalCardAmount?: number | string;
    registerFiscal?: boolean;
    refundsTotal?: number | string;
    isRefunded?: boolean;
    paidAt?: string | null;
  }>;
  receipts?: Array<{
    id: string;
    printDocument?: string | null;
    status: string;
    kind?: 'plain' | 'fiscal' | 'refund';
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
  kitchenPrintDocuments?: string[];
};

export type CashierCreateOrderResponse = {
  id: string;
};
