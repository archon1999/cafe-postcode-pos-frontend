import type { CashierRepository } from 'modules/cashier/domain';
import { apiDelete, apiPatch, apiPost } from 'shared/api/client';

import { mapCashierCreateOrderResponse, mapCashierOrder } from '../mappers';

type CreateBuilderOrderPayload = Parameters<CashierRepository['createBuilderOrder']>[0];
type CreateOrderResponse = Awaited<ReturnType<CashierRepository['createBuilderOrder']>>;
type OrderChannel = Parameters<CashierRepository['updateOrderChannel']>[1];
type OrderResponse = Awaited<ReturnType<CashierRepository['updateOrderChannel']>>;
type AddOrderItemResponse = Awaited<ReturnType<CashierRepository['addOrderItem']>>;
type MarkingMode = Parameters<CashierRepository['scanOrderMarking']>[2];
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

  addOrderItem(orderId: string, catalogItemId: string, note: string) {
    return apiPost<AddOrderItemResponse>(`/pos/sales/orders/${orderId}/items/`, {
      catalogItem: catalogItemId,
      quantity: 1,
      note,
    });
  },

  async scanOrderMarking(orderId: string, rawCode: string, mode: MarkingMode): Promise<OrderResponse> {
    const payload = await apiPost<{ order: OrderResponse }>(`/pos/sales/orders/${orderId}/scan-marking/`, {
      rawCode,
      mode,
    });
    return mapCashierOrder(payload.order);
  },

  async removeOrderItem(itemId: string) {
    await apiDelete(`/pos/sales/orders/items/${itemId}/`);
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
