import type {
  Hall,
  TableSession,
  WaiterCreateOrderResponse,
  WaiterMenuCategory,
  WaiterOrder,
  WaiterPrintPrebillResponse,
  WaiterSessionResponse,
} from '../entities';

export interface WaiterRepository {
  getHalls(): Promise<Hall[]>;
  openTableSession(tableId: string, guestCount: number): Promise<WaiterSessionResponse>;
  reserveTable(tableId: string): Promise<void>;
  getTableSession(sessionId: string): Promise<TableSession>;
  getMenu(): Promise<WaiterMenuCategory[]>;
  getOrders(): Promise<WaiterOrder[]>;
  createOrder(sessionId: string, note: string): Promise<WaiterCreateOrderResponse>;
  createTakeawayOrder(note: string): Promise<WaiterCreateOrderResponse>;
  addOrderItem(orderId: string, catalogItemId: string, note: string): Promise<void>;
  removeOrderItem(itemId: string): Promise<void>;
  submitOrder(orderId: string): Promise<void>;
  printPrebill(orderId: string): Promise<WaiterPrintPrebillResponse>;
  markReceiptPrintResult(receiptId: string, result: Record<string, unknown>): Promise<WaiterPrintPrebillResponse>;
}
