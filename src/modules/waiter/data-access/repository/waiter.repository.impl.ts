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
    return mapHalls(unwrapCollection(await apiGet<CollectionPayload<Hall>>('/pos/floor/halls/')));
  }

  async openTableSession(tableId: string, guestCount: number): Promise<WaiterSessionResponse> {
    return mapWaiterSessionResponse(
      await apiPost<WaiterSessionResponse>('/pos/floor/table-sessions/', {
        table: tableId,
        guestCount,
      }),
    );
  }

  async reserveTable(tableId: string): Promise<void> {
    await apiPost(`/pos/floor/tables/${tableId}/reserve/`);
  }

  async getTableSession(sessionId: string): Promise<TableSession> {
    return mapTableSession(await apiGet<TableSession>(`/pos/floor/table-sessions/${sessionId}/`));
  }

  async getMenu(): Promise<WaiterMenuCategory[]> {
    return mapWaiterMenuCategories(
      unwrapCollection(await apiGet<CollectionPayload<WaiterMenuCategory>>('/pos/catalog/menu/')),
    );
  }

  async getOrders(): Promise<WaiterOrder[]> {
    return mapWaiterOrders(unwrapCollection(await apiGet<CollectionPayload<WaiterOrder>>('/pos/sales/orders/')));
  }

  async createOrder(sessionId: string, note: string): Promise<WaiterCreateOrderResponse> {
    return mapWaiterCreateOrderResponse(
      await apiPost<WaiterCreateOrderResponse>('/pos/sales/orders/', {
        tableSession: sessionId,
        channel: 'hall',
        note,
      }),
    );
  }

  async createTakeawayOrder(note: string): Promise<WaiterCreateOrderResponse> {
    return mapWaiterCreateOrderResponse(
      await apiPost<WaiterCreateOrderResponse>('/pos/sales/orders/', {
        channel: 'takeaway',
        guestCount: 1,
        note,
      }),
    );
  }

  async addOrderItem(orderId: string, catalogItemId: string, note: string) {
    return apiPost<{ kitchenPrintDocuments?: string[] }>(`/pos/sales/orders/${orderId}/items/`, {
      catalogItem: catalogItemId,
      quantity: 1,
      note,
    });
  }

  async removeOrderItem(itemId: string) {
    await apiDelete(`/pos/sales/orders/items/${itemId}/`);
  }

  async submitOrder(orderId: string) {
    return apiPost<WaiterOrder>(`/pos/sales/orders/${orderId}/submit/`);
  }
}

export const waiterRepository: WaiterRepository = new WaiterRepositoryImpl();
