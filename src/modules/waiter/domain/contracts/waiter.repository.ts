import type { PosModifierSelection } from 'shared/pos/modifiers';

import type {
  Hall,
  TableSession,
  TableOperationResponse,
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
  getTableSession(sessionId: string): Promise<TableSession | null>;
  transferTableSession(
    sessionId: string,
    targetTableId: string,
    expectedTargetSessionIds: string[],
    targetSessionId?: string,
  ): Promise<TableOperationResponse>;
  groupTableSession(sessionId: string, tableIds: string[]): Promise<TableOperationResponse>;
  ungroupTableSession(sessionId: string, tableIds?: string[]): Promise<TableOperationResponse>;
  getMenu(): Promise<WaiterMenuCategory[]>;
  getOrders(): Promise<WaiterOrder[]>;
  createOrder(sessionId: string, note: string): Promise<WaiterCreateOrderResponse>;
  createTakeawayOrder(note: string): Promise<WaiterCreateOrderResponse>;
  addOrderItem(
    orderId: string,
    catalogItemId: string,
    note: string,
    selectedModifiers?: PosModifierSelection[],
    manualPrice?: number,
  ): Promise<{ kitchenPrintDocuments?: string[] }>;
  addOrderItems(
    orderId: string,
    items: Array<{
      catalogItemId: string;
      quantity: number;
      note: string;
      selectedModifiers?: PosModifierSelection[];
      manualPrice?: number;
    }>,
  ): Promise<{ kitchenPrintDocuments?: string[] }>;
  removeOrderItem(itemId: string): Promise<{ kitchenPrintDocuments: string[]; orderRemoved?: boolean }>;
  updateOrderItemNote(itemId: string, note: string): Promise<void>;
  updateOrderNote(orderId: string, note: string): Promise<WaiterOrder>;
  submitOrder(orderId: string): Promise<WaiterOrder>;
  createPrecheckPrintDocument(orderId: string): Promise<WaiterPrecheckPrintDocumentResponse>;
}
