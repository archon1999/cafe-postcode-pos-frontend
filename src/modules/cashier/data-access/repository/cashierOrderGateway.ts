import type { CashierRepository } from 'modules/cashier/domain';
import { apiDelete, apiPatch, apiPost } from 'shared/api/client';

import { mapCashierCreateOrderResponse, mapCashierOrder } from '../mappers';

type CreateBuilderOrderPayload = Parameters<CashierRepository['createBuilderOrder']>[0];
type CreateOrderResponse = Awaited<ReturnType<CashierRepository['createBuilderOrder']>>;
type OrderChannel = Parameters<CashierRepository['updateOrderChannel']>[1];
type OrderResponse = Awaited<ReturnType<CashierRepository['updateOrderChannel']>>;
type AddOrderItemResponse = Awaited<ReturnType<CashierRepository['addOrderItem']>>;
type RemoveOrderItemResponse = Awaited<ReturnType<CashierRepository['removeOrderItem']>>;
type MarkingMode = Parameters<CashierRepository['scanOrderMarking']>[2];
type ScanOrderMarkingResponse = Awaited<ReturnType<CashierRepository['scanOrderMarking']>>;
type DeliveryDetails = Parameters<CashierRepository['updateOrderDeliveryDetails']>[1];

async function createBuilderOrder(payload: CreateBuilderOrderPayload): Promise<CreateOrderResponse> {
  return mapCashierCreateOrderResponse(
    await apiPost<CreateOrderResponse>('/pos/sales/orders/', {
      channel: payload.channel,
      guestCount: 1,
      note: payload.note,
      deliveryPhone: payload.deliveryPhone,
      deliveryAddress: payload.deliveryAddress,
    }),
  );
}

export const cashierOrderGateway = {
  createBuilderOrder,

  createTakeawayOrder(note: string) {
    return createBuilderOrder({ channel: 'takeaway', note });
  },

  async updateOrderChannel(orderId: string, channel: OrderChannel): Promise<OrderResponse> {
    return mapCashierOrder(await apiPatch<OrderResponse>(`/pos/sales/orders/${orderId}/`, { channel }));
  },

  addOrderItem(
    orderId: string,
    catalogItemId: string,
    note: string,
    selectedModifiers: Parameters<CashierRepository['addOrderItem']>[3] = [],
    manualPrice?: number,
  ) {
    return apiPost<AddOrderItemResponse>(`/pos/sales/orders/${orderId}/items/`, {
      catalogItem: catalogItemId,
      quantity: 1,
      note,
      ...(manualPrice !== undefined ? { manualPrice } : {}),
      ...(selectedModifiers.length ? { selectedModifiers } : {}),
    });
  },

  addOrderItems(orderId: string, items: Parameters<CashierRepository['addOrderItems']>[1]) {
    return apiPost<Awaited<ReturnType<CashierRepository['addOrderItems']>>>(
      `/pos/sales/orders/${orderId}/items/bulk/`,
      {
        items: items.map((item) => ({
          catalogItem: item.catalogItemId,
          quantity: item.quantity,
          note: item.note,
          ...(item.manualPrice !== undefined ? { manualPrice: item.manualPrice } : {}),
          ...(item.selectedModifiers?.length ? { selectedModifiers: item.selectedModifiers } : {}),
        })),
      },
    );
  },

  async scanOrderMarking(orderId: string, rawCode: string, mode: MarkingMode): Promise<ScanOrderMarkingResponse> {
    const payload = await apiPost<{ order: OrderResponse; kitchenPrintDocuments?: string[] }>(
      `/pos/sales/orders/${orderId}/scan-marking/`,
      {
        rawCode,
        mode,
      },
    );
    return {
      order: mapCashierOrder(payload.order),
      kitchenPrintDocuments: payload.kitchenPrintDocuments ?? [],
    };
  },

  async removeOrderItem(
    itemId: string,
    inventoryDisposition?: import('shared/pos/inventory').InventoryDisposition,
  ): Promise<RemoveOrderItemResponse> {
    const payload = await apiDelete<Partial<RemoveOrderItemResponse> | undefined>(
      `/pos/sales/orders/items/${itemId}/`,
      ...(inventoryDisposition ? [{ inventoryDisposition }] : []),
    );
    return {
      kitchenPrintDocuments: payload?.kitchenPrintDocuments ?? [],
      ...(payload?.orderRemoved ? { orderRemoved: true } : {}),
    };
  },

  async updateOrderItemNote(itemId: string, note: string): Promise<void> {
    await apiPatch(`/pos/sales/orders/items/${itemId}/`, { note });
  },

  async updateOrderNote(orderId: string, note: string): Promise<OrderResponse> {
    return mapCashierOrder(await apiPatch<OrderResponse>(`/pos/sales/orders/${orderId}/`, { note }));
  },

  async updateOrderDisplayName(orderId: string, displayName: string): Promise<OrderResponse> {
    return mapCashierOrder(await apiPatch<OrderResponse>(`/pos/sales/orders/${orderId}/`, { displayName }));
  },

  async updateOrderDeliveryDetails(orderId: string, payload: DeliveryDetails): Promise<OrderResponse> {
    return mapCashierOrder(
      await apiPatch<OrderResponse>(`/pos/sales/orders/${orderId}/`, {
        deliveryPhone: payload.deliveryPhone,
        deliveryAddress: payload.deliveryAddress,
      }),
    );
  },

  async submitOrder(orderId: string): Promise<OrderResponse> {
    return mapCashierOrder(await apiPost<OrderResponse>(`/pos/sales/orders/${orderId}/submit/`));
  },
};
