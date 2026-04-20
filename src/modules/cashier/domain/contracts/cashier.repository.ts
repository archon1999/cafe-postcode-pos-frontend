import type {
  CashierContext,
  CashierCreateOrderResponse,
  CashierMenuCategory,
  CashierOrder,
  CashierPaymentResponse,
  PaymentMethod,
} from '../entities';

type CashierReceipt = NonNullable<CashierOrder['receipts']>[number];

export interface CashierRepository {
  getCashierContext(): Promise<CashierContext>;
  getMenu(): Promise<CashierMenuCategory[]>;
  getOpenOrders(): Promise<CashierOrder[]>;
  getOpenChecks(status?: 'open' | 'closed'): Promise<CashierOrder[]>;
  getOrder(orderId: string): Promise<CashierOrder>;
  openShift(payload: { cashDeskId?: string; openingCashAmount: number; notesOpen?: string }): Promise<CashierContext>;
  closeShift(payload: { actualClosingCashAmount: number; notesClose?: string }): Promise<CashierContext>;
  createTakeawayOrder(note: string): Promise<CashierCreateOrderResponse>;
  addOrderItem(orderId: string, catalogItemId: string, note: string): Promise<void>;
  removeOrderItem(itemId: string): Promise<void>;
  updateOrderDisplayName(orderId: string, displayName: string): Promise<CashierOrder>;
  submitOrder(orderId: string): Promise<void>;
  payOrder(orderId: string, method: PaymentMethod, amount: number): Promise<CashierPaymentResponse>;
  refundPayment(paymentId: string, reason?: string): Promise<{ refund: unknown; receipt: CashierReceipt | null }>;
  reprintReceipt(receiptId: string): Promise<{ receipt: CashierReceipt | null }>;
}
