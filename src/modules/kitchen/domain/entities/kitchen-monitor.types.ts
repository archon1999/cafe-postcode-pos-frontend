import type { KitchenTicketStatus } from '../enums';

export type KitchenMonitorTicket = {
  id: string;
  orderNumber: number;
  status: KitchenTicketStatus;
  completedAt?: string | null;
};

export type KitchenMonitorQueue = {
  preparing: KitchenMonitorTicket[];
  recentlyDone: KitchenMonitorTicket[];
};
