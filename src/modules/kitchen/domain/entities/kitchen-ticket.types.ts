import type { KitchenItemStatus, KitchenTicketStatus } from '../enums';

export type KitchenItem = {
  id: string;
  catalogItemName: string;
  quantity: number | string;
  lineTotal: number | string;
  note?: string;
  status: KitchenItemStatus;
};

export type KitchenTicket = {
  id: string;
  orderNumber: number;
  displayName?: string | null;
  channel: 'delivery' | 'hall' | 'online' | 'takeaway';
  prepStationName: string;
  status: KitchenTicketStatus;
  hallName: string | null;
  tableName: string | null;
  waiterName?: string | null;
  items: KitchenItem[];
  createdAt?: string;
};
