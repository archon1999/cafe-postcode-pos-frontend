import type { PosOrderItemModifier } from 'shared/pos/modifiers';
import type { PosServiceFeeComponent } from 'shared/pos/service-fees';

export type WaiterOrderItem = {
  id: string;
  catalogItem: string;
  catalogItemName: string;
  quantity: number | string;
  saleUnit?: 'piece' | 'kg';
  lineTotal: number | string;
  baseUnitPrice?: number | string;
  unitPrice?: number | string;
  status: string;
  prepStationName?: string | null;
  note?: string;
  modifiers?: PosOrderItemModifier[];
};

export type WaiterOrder = {
  id: string;
  tableSession: string | null;
  openedBy?: string;
  orderNumber: number;
  displayName?: string | null;
  status: string;
  subtotal: number | string;
  serviceFee: number | string;
  serviceFeeEnabled?: boolean;
  serviceFeePercent?: number | string;
  serviceFeeComponents?: PosServiceFeeComponent[];
  vatEnabled?: boolean;
  vatPercent?: number | string;
  vatAmount?: number | string;
  total: number | string;
  note: string;
  channel: string;
  items: WaiterOrderItem[];
  kitchenPrintDocuments?: string[];
};

export type WaiterCreateOrderResponse = {
  id: string;
};

export type WaiterPrecheckPrintDocumentResponse = {
  printDocument: string;
};
