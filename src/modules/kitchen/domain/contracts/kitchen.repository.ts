import type { KitchenItemStatus, KitchenTicket, KitchenTicketStatus } from '../index';

export interface KitchenRepository {
  getQueue(): Promise<KitchenTicket[]>;
  updateTicketStatus(ticketId: string, status: KitchenTicketStatus): Promise<void>;
  updateItemStatus(itemId: string, status: KitchenItemStatus): Promise<void>;
}
