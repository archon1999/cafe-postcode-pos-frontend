import type {
  CashierContext,
  CashierBuilderOrderChannel,
  CashierCheckStatus,
  CashierCreateOrderResponse,
  CashierMenuCategory,
  CashierOrder,
  CashierPaymentResponse,
  CashierShiftCloseResponse,
  CashierShiftReportResponse,
  PaymentMethod,
} from '../entities';

type CashierReceipt = NonNullable<CashierOrder['receipts']>[number];

export type CashierChecksParams = {
  search?: string;
  page?: number;
  pageSize?: number;
};

export type CashierChecksResult = {
  orders: CashierOrder[];
  count: number;
  page: number;
  pageSize: number;
  numPages: number;
};

export interface CashierRepository {
  getCashierContext(): Promise<CashierContext>;
  getMenu(): Promise<CashierMenuCategory[]>;
  getOpenOrders(): Promise<CashierOrder[]>;
  getOpenChecks(status?: CashierCheckStatus, params?: CashierChecksParams): Promise<CashierChecksResult>;
  getOrder(orderId: string): Promise<CashierOrder>;
  openShift(payload: {
    cashDeskId?: string;
    cashierId?: string;
    openingCashAmount: number;
    notesOpen?: string;
  }): Promise<CashierContext>;
  closeShift(payload: {
    cashShiftId?: string;
    actualClosingCashAmount?: number;
    notesClose?: string;
    closeFiscalShift?: boolean;
  }): Promise<CashierShiftCloseResponse>;
  printShiftReport(payload: { cashShiftId?: string }): Promise<CashierShiftReportResponse>;
  createBuilderOrder(payload: {
    channel: CashierBuilderOrderChannel;
    note: string;
    deliveryPhone?: string;
    deliveryAddress?: string;
  }): Promise<CashierCreateOrderResponse>;
  createTakeawayOrder(note: string): Promise<CashierCreateOrderResponse>;
  updateOrderChannel(orderId: string, channel: CashierBuilderOrderChannel): Promise<CashierOrder>;
  addOrderItem(orderId: string, catalogItemId: string, note: string): Promise<{ kitchenPrintDocuments?: string[] }>;
  scanOrderMarking(orderId: string, rawCode: string, mode: 'add' | 'attach' | 'remove'): Promise<CashierOrder>;
  removeOrderItem(itemId: string): Promise<void>;
  updateOrderDisplayName(orderId: string, displayName: string): Promise<CashierOrder>;
  updateOrderDeliveryDetails(
    orderId: string,
    payload: { deliveryPhone: string; deliveryAddress: string },
  ): Promise<CashierOrder>;
  submitOrder(orderId: string): Promise<CashierOrder>;
  payOrder(
    orderId: string,
    method: PaymentMethod,
    amount: number,
    options?: {
      cashAmount?: number;
      cardAmount?: number;
      manualCardOverride?: boolean;
      manualCardReason?: string;
      registerFiscal?: boolean;
    },
  ): Promise<CashierPaymentResponse>;
  retryFiscalPayment(paymentId: string): Promise<{
    payment: unknown;
    receipt: CashierReceipt | null;
    receipts?: CashierReceipt[];
    result?: Record<string, unknown>;
    results?: Record<string, unknown>[];
  }>;
  openFiscalShift(payload?: { cashDeskId?: string }): Promise<Record<string, unknown>>;
  closeFiscalShift(payload?: { cashDeskId?: string }): Promise<Record<string, unknown>>;
  refundPayment(paymentId: string, reason?: string): Promise<{ refund: unknown; receipt: CashierReceipt | null }>;
  ensurePaymentPrintDocument(paymentId: string): Promise<{ receipt: CashierReceipt | null }>;
}
