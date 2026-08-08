import type { PosOrderItemModifier } from 'shared/pos/modifiers';

export type WaiterOrderItem = {
  id: string;
  catalogItem: string;
  catalogItemName: string;
  quantity: number | string;
  lineTotal: number | string;
  baseUnitPrice?: number | string;
  unitPrice?: number | string;
  status: string;
  prepStationName?: string | null;
  note?: string;
  modifiers?: PosOrderItemModifier[];
  kitchenDispatched?: boolean;
  kitchenDispatchNumber?: number | null;
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
  vatEnabled?: boolean;
  vatPercent?: number | string;
  vatAmount?: number | string;
  total: number | string;
  note: string;
  channel: string;
  items: WaiterOrderItem[];
  kitchenPrintDocuments?: string[];
  kitchenDispatchCount?: number;
};

export type WaiterCreateOrderResponse = {
  id: string;
};
