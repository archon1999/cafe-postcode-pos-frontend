import type {
  Hall,
  TableSession,
  WaiterCreateOrderResponse,
  WaiterMenuCategory,
  WaiterOrder,
  WaiterRepository,
  WaiterSessionResponse,
} from 'modules/waiter/domain';
import { apiDelete, apiGet, apiPost, unwrapCollection } from 'shared/api/client';

import {
  mapHalls,
  mapTableSession,
  mapWaiterCreateOrderResponse,
  mapWaiterMenuCategories,
  mapWaiterOrders,
  mapWaiterSessionResponse,
} from '../mappers';

type CollectionPayload<T> = T[] | { data?: T[] };

class WaiterRepositoryImpl implements WaiterRepository {
  async getHalls(): Promise<Hall[]> {
    return mapHalls(unwrapCollection(await apiGet<CollectionPayload<Hall>>('/pos/halls/')));
  }

  async openTableSession(tableId: string, guestCount: number): Promise<WaiterSessionResponse> {
    return mapWaiterSessionResponse(
      await apiPost<WaiterSessionResponse>('/pos/halls/table-sessions/', {
        table: tableId,
        guestCount,
      }),
    );
  }

  async getTableSession(sessionId: string): Promise<TableSession> {
    return mapTableSession(await apiGet<TableSession>(`/pos/halls/table-sessions/${sessionId}/`));
  }

  async getMenu(): Promise<WaiterMenuCategory[]> {
    return mapWaiterMenuCategories(
      unwrapCollection(await apiGet<CollectionPayload<WaiterMenuCategory>>('/pos/catalog/menu/')),
    );
  }

  async getOrders(): Promise<WaiterOrder[]> {
    return mapWaiterOrders(unwrapCollection(await apiGet<CollectionPayload<WaiterOrder>>('/pos/orders/')));
  }

  async createOrder(sessionId: string, note: string): Promise<WaiterCreateOrderResponse> {
    return mapWaiterCreateOrderResponse(
      await apiPost<WaiterCreateOrderResponse>('/pos/orders/', {
        tableSession: sessionId,
        channel: 'hall',
        note,
      }),
    );
  }

  async createTakeawayOrder(note: string): Promise<WaiterCreateOrderResponse> {
    return mapWaiterCreateOrderResponse(
      await apiPost<WaiterCreateOrderResponse>('/pos/orders/', {
        channel: 'takeaway',
        guestCount: 1,
        note,
      }),
    );
  }

  async addOrderItem(orderId: string, catalogItemId: string, note: string) {
    await apiPost(`/pos/orders/${orderId}/items/`, {
      catalogItem: catalogItemId,
      quantity: 1,
      note,
    });
  }

  async removeOrderItem(itemId: string) {
    await apiDelete(`/pos/orders/items/${itemId}/`);
  }

  async submitOrder(orderId: string) {
    await apiPost(`/pos/orders/${orderId}/submit/`);
  }
}

export const waiterRepository: WaiterRepository = new WaiterRepositoryImpl();
