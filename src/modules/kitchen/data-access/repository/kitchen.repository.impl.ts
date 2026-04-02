import type { KitchenItemStatus, KitchenRepository, KitchenTicket, KitchenTicketStatus } from 'modules/kitchen/domain';
import { apiGet, apiPost, unwrapCollection } from 'shared/api/client';

import { mapKitchenTickets } from '../mappers';

type CollectionPayload<T> = T[] | { data?: T[] };

class KitchenRepositoryImpl implements KitchenRepository {
  async getQueue(): Promise<KitchenTicket[]> {
    return mapKitchenTickets(unwrapCollection(await apiGet<CollectionPayload<KitchenTicket>>('/pos/kitchen/queue/')));
  }

  async updateTicketStatus(ticketId: string, status: KitchenTicketStatus) {
    await apiPost(`/pos/kitchen/tickets/${ticketId}/status/`, { status });
  }

  async updateItemStatus(itemId: string, status: KitchenItemStatus) {
    await apiPost(`/pos/kitchen/items/${itemId}/status/`, { status });
  }
}

export const kitchenRepository: KitchenRepository = new KitchenRepositoryImpl();
