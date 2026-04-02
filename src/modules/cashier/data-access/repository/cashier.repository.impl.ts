import type {
  CashierContext,
  CashierCreateOrderResponse,
  CashierMenuCategory,
  CashierOrder,
  CashierPaymentResponse,
  CashierRepository,
  PaymentMethod,
} from 'modules/cashier/domain';
import { apiDelete, apiGet, apiPost, unwrapCollection } from 'shared/api/client';

import {
  mapCashierCreateOrderResponse,
  mapCashierMenuCategories,
  mapCashierOrder,
  mapCashierOrders,
  mapCashierPaymentResponse,
} from '../mappers';

type CollectionPayload<T> = T[] | { data?: T[] };
type CashierReceipt = NonNullable<CashierOrder['receipts']>[number];

class CashierRepositoryImpl implements CashierRepository {
  async getCashierContext(): Promise<CashierContext> {
    return apiGet<CashierContext>('/pos/cashier/context/');
  }

  async getMenu(): Promise<CashierMenuCategory[]> {
    return mapCashierMenuCategories(
      unwrapCollection(await apiGet<CollectionPayload<CashierMenuCategory>>('/pos/catalog/menu/')),
    );
  }

  async getOpenOrders(): Promise<CashierOrder[]> {
    return mapCashierOrders(
      unwrapCollection(await apiGet<CollectionPayload<CashierOrder>>('/pos/orders/?status=open')),
    );
  }

  async getOpenChecks(status: 'open' | 'closed' = 'open'): Promise<CashierOrder[]> {
    return mapCashierOrders(
      unwrapCollection(await apiGet<CollectionPayload<CashierOrder>>(`/pos/payments/open-checks/?status=${status}`)),
    );
  }

  async getOrder(orderId: string): Promise<CashierOrder> {
    return mapCashierOrder(await apiGet<CashierOrder>(`/pos/orders/${orderId}/`));
  }

  async openShift(payload: {
    cashDeskId?: string;
    openingCashAmount: number;
    notesOpen?: string;
  }): Promise<CashierContext> {
    return apiPost<CashierContext>('/pos/cashier/shifts/open/', payload);
  }

  async closeShift(payload: { actualClosingCashAmount: number; notesClose?: string }): Promise<CashierContext> {
    return apiPost<CashierContext>('/pos/cashier/shifts/current/close/', payload);
  }

  async createTakeawayOrder(note: string): Promise<CashierCreateOrderResponse> {
    return mapCashierCreateOrderResponse(
      await apiPost<CashierCreateOrderResponse>('/pos/orders/', {
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

  async payOrder(orderId: string, method: PaymentMethod, amount: number): Promise<CashierPaymentResponse> {
    return mapCashierPaymentResponse(
      await apiPost<CashierPaymentResponse>(`/pos/payments/orders/${orderId}/pay/`, {
        method,
        amount,
      }),
    );
  }

  async refundPayment(paymentId: string, reason = '') {
    return apiPost<{ refund: unknown; receipt: CashierReceipt | null }>(`/pos/payments/${paymentId}/refund/`, {
      reason,
    });
  }

  async reprintReceipt(receiptId: string) {
    return apiPost<{ receipt: CashierReceipt | null }>(`/pos/receipts/${receiptId}/reprint/`);
  }
}

export const cashierRepository: CashierRepository = new CashierRepositoryImpl();
