import type {
  Hall,
  TableSession,
  WaiterCreateOrderResponse,
  WaiterMenuCategory,
  WaiterOrder,
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
  addOrderItem(orderId: string, catalogItemId: string, note: string): Promise<{ kitchenPrintDocuments?: string[] }>;
  removeOrderItem(itemId: string): Promise<void>;
  updateOrderNote(orderId: string, note: string): Promise<WaiterOrder>;
  submitOrder(orderId: string): Promise<WaiterOrder>;
}
