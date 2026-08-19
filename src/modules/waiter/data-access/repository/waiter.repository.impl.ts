import type {
  Hall,
  TableSession,
  WaiterCreateOrderResponse,
  WaiterMenuCategory,
  WaiterOrder,
  WaiterPrecheckPrintDocumentResponse,
  WaiterRepository,
  WaiterSessionResponse,
} from 'modules/waiter/domain';
import { apiDelete, apiGet, apiPatch, apiPost, unwrapCollection } from 'shared/api/client';

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

  async addOrderItem(
    orderId: string,
    catalogItemId: string,
    note: string,
    selectedModifiers: Parameters<WaiterRepository['addOrderItem']>[3] = [],
    manualPrice?: number,
  ) {
    return apiPost<{ kitchenPrintDocuments?: string[] }>(`/pos/sales/orders/${orderId}/items/`, {
      catalogItem: catalogItemId,
      quantity: 1,
      note,
      ...(manualPrice !== undefined ? { manualPrice } : {}),
      ...(selectedModifiers.length ? { selectedModifiers } : {}),
    });
  }

  async addOrderItems(orderId: string, items: Parameters<WaiterRepository['addOrderItems']>[1]) {
    return apiPost<Awaited<ReturnType<WaiterRepository['addOrderItems']>>>(`/pos/sales/orders/${orderId}/items/bulk/`, {
      items: items.map((item) => ({
        catalogItem: item.catalogItemId,
        quantity: item.quantity,
        note: item.note,
        ...(item.manualPrice !== undefined ? { manualPrice: item.manualPrice } : {}),
        ...(item.selectedModifiers?.length ? { selectedModifiers: item.selectedModifiers } : {}),
      })),
    });
  }

  async removeOrderItem(itemId: string) {
    const payload = await apiDelete<{ kitchenPrintDocuments?: string[]; orderRemoved?: boolean } | undefined>(
      `/pos/sales/orders/items/${itemId}/`,
    );
    return {
      kitchenPrintDocuments: payload?.kitchenPrintDocuments ?? [],
      ...(payload?.orderRemoved ? { orderRemoved: true } : {}),
    };
  }

  async updateOrderNote(orderId: string, note: string) {
    return apiPatch<WaiterOrder>(`/pos/sales/orders/${orderId}/`, { note });
  }

  async submitOrder(orderId: string) {
    return apiPost<WaiterOrder>(`/pos/sales/orders/${orderId}/submit/`);
  }

  async createPrecheckPrintDocument(orderId: string) {
    return apiPost<WaiterPrecheckPrintDocumentResponse>(`/pos/billing/orders/${orderId}/precheck/print-document/`);
  }
}

export const waiterRepository: WaiterRepository = new WaiterRepositoryImpl();
