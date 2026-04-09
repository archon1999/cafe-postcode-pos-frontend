import type { KitchenItemStatus, KitchenMonitorQueue, KitchenTicket, KitchenTicketStatus } from '../index';

export interface KitchenRepository {
  getQueue(): Promise<KitchenTicket[]>;
  getMonitorQueue(restaurantId: string): Promise<KitchenMonitorQueue>;
  updateTicketStatus(ticketId: string, status: KitchenTicketStatus): Promise<void>;
  updateItemStatus(itemId: string, status: KitchenItemStatus): Promise<void>;
}
