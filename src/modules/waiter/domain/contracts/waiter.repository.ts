import type { PosModifierSelection } from 'shared/pos/modifiers';

import type {
  Hall,
  TableSession,
  WaiterCreateOrderResponse,
  WaiterMenuCategory,
  WaiterOrder,
  WaiterPrecheckPrintDocumentResponse,
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
  addOrderItem(
    orderId: string,
    catalogItemId: string,
    note: string,
    selectedModifiers?: PosModifierSelection[],
  ): Promise<{ kitchenPrintDocuments?: string[] }>;
  addOrderItems(
    orderId: string,
    items: Array<{
      catalogItemId: string;
      quantity: number;
      note: string;
      selectedModifiers?: PosModifierSelection[];
    }>,
  ): Promise<{ kitchenPrintDocuments?: string[] }>;
  removeOrderItem(itemId: string): Promise<void>;
  updateOrderNote(orderId: string, note: string): Promise<WaiterOrder>;
  submitOrder(orderId: string): Promise<WaiterOrder>;
  createPrecheckPrintDocument(orderId: string): Promise<WaiterPrecheckPrintDocumentResponse>;
}
