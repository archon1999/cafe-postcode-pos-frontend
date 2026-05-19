import type {
  CashierContext,
  CashierCheckStatus,
  CashierChecksParams,
  CashierChecksResult,
  CashierCreateOrderResponse,
  CashierMenuCategory,
  CashierOrder,
  CashierPaymentResponse,
  CashierRepository,
  CashierShiftCloseResponse,
  MartaPaymentInitiateResponse,
  MartaTerminalResultPayload,
  PaymentMethod,
} from 'modules/cashier/domain';
import { apiDelete, apiGet, apiPatch, apiPost, unwrapCollection } from 'shared/api/client';

import {
  mapCashierCreateOrderResponse,
  mapCashierMenuCategories,
  mapCashierOrder,
  mapCashierOrders,
  mapCashierPaymentResponse,
} from '../mappers';

type CollectionPayload<T> = T[] | { data?: T[] };
type ChecksPayload<T> =
  | T[]
  | {
      data?: T[];
      count?: number;
      page?: number;
      pageSize?: number;
      page_size?: number;
      numPages?: number;
      num_pages?: number;
    };
type CashierReceipt = NonNullable<CashierOrder['receipts']>[number];

class CashierRepositoryImpl implements CashierRepository {
  async getCashierContext(): Promise<CashierContext> {
    return apiGet<CashierContext>('/pos/billing/context/');
  }

  async getMenu(): Promise<CashierMenuCategory[]> {
    return mapCashierMenuCategories(
      unwrapCollection(await apiGet<CollectionPayload<CashierMenuCategory>>('/pos/catalog/menu/')),
    );
  }

  async getOpenOrders(): Promise<CashierOrder[]> {
    return mapCashierOrders(
      unwrapCollection(await apiGet<CollectionPayload<CashierOrder>>('/pos/sales/orders/?status=open')),
    );
  }

  async getOpenChecks(status: CashierCheckStatus = 'open', params?: CashierChecksParams): Promise<CashierChecksResult> {
    const query = new URLSearchParams({ status });
    if (params?.search) {
      query.set('search', params.search);
    }
    if (params?.page) {
      query.set('page', String(params.page));
    }
    if (params?.pageSize) {
      query.set('page_size', String(params.pageSize));
    }
    const payload = await apiGet<ChecksPayload<CashierOrder>>(`/pos/billing/open-checks/?${query.toString()}`);
    const orders = mapCashierOrders(unwrapCollection(payload));
    if (Array.isArray(payload)) {
      return { orders, count: orders.length, page: 1, pageSize: orders.length, numPages: 1 };
    }
    return {
      orders,
      count: Number(payload.count ?? orders.length),
      page: Number(payload.page ?? 1),
      pageSize: Number(payload.pageSize ?? payload.page_size ?? orders.length),
      numPages: Number(payload.numPages ?? payload.num_pages ?? 1),
    };
  }

  async getOrder(orderId: string): Promise<CashierOrder> {
    return mapCashierOrder(await apiGet<CashierOrder>(`/pos/sales/orders/${orderId}/`));
  }

  async openShift(payload: {
    cashDeskId?: string;
    cashierId?: string;
    openingCashAmount: number;
    notesOpen?: string;
  }): Promise<CashierContext> {
    return apiPost<CashierContext>('/pos/billing/shifts/open/', payload);
  }

  async closeShift(payload: {
    cashShiftId?: string;
    actualClosingCashAmount?: number;
    notesClose?: string;
    closeFiscalShift?: boolean;
  }): Promise<CashierShiftCloseResponse> {
    return apiPost<CashierShiftCloseResponse>('/pos/billing/shifts/current/close/', payload);
  }

  async createTakeawayOrder(note: string): Promise<CashierCreateOrderResponse> {
    return mapCashierCreateOrderResponse(
      await apiPost<CashierCreateOrderResponse>('/pos/sales/orders/', {
        channel: 'takeaway',
        guestCount: 1,
        note,
      }),
    );
  }

  async addOrderItem(orderId: string, catalogItemId: string, note: string) {
    await apiPost(`/pos/sales/orders/${orderId}/items/`, {
      catalogItem: catalogItemId,
      quantity: 1,
      note,
    });
  }

  async scanOrderMarking(orderId: string, rawCode: string, mode: 'add' | 'attach' | 'remove'): Promise<CashierOrder> {
    const payload = await apiPost<{ order: CashierOrder }>(`/pos/sales/orders/${orderId}/scan-marking/`, {
      rawCode,
      mode,
    });
    return mapCashierOrder(payload.order);
  }

  async removeOrderItem(itemId: string) {
    await apiDelete(`/pos/sales/orders/items/${itemId}/`);
  }

  async updateOrderDisplayName(orderId: string, displayName: string) {
    return mapCashierOrder(
      await apiPatch<CashierOrder>(`/pos/sales/orders/${orderId}/`, {
        displayName,
      }),
    );
  }

  async submitOrder(orderId: string) {
    await apiPost(`/pos/sales/orders/${orderId}/submit/`);
  }

  async payOrder(
    orderId: string,
    method: PaymentMethod,
    amount: number,
    options?: { manualCardOverride?: boolean; manualCardReason?: string; registerFiscal?: boolean },
  ): Promise<CashierPaymentResponse> {
    return mapCashierPaymentResponse(
      await apiPost<CashierPaymentResponse>(`/pos/billing/orders/${orderId}/pay/`, {
        method,
        amount,
        register_fiscal: options?.registerFiscal ?? true,
        manual_card_override: Boolean(options?.manualCardOverride),
        manual_card_reason: options?.manualCardReason ?? '',
      }),
    );
  }

  async initiateMartaCardPayment(
    orderId: string,
    amount: number,
    registerFiscal = true,
  ): Promise<MartaPaymentInitiateResponse> {
    return apiPost<MartaPaymentInitiateResponse>(`/pos/billing/orders/${orderId}/card-payments/initiate/`, {
      amount,
      register_fiscal: registerFiscal,
    });
  }

  async completeMartaTerminalPayment(
    paymentId: string,
    terminalResult: MartaTerminalResultPayload,
  ): Promise<CashierPaymentResponse> {
    return mapCashierPaymentResponse(
      await apiPost<CashierPaymentResponse>(`/pos/billing/payments/${paymentId}/terminal-result/`, terminalResult),
    );
  }

  async retryFiscalPayment(paymentId: string) {
    return apiPost<{
      payment: unknown;
      receipt: CashierReceipt | null;
      receipts?: CashierReceipt[];
      result?: Record<string, unknown>;
      results?: Record<string, unknown>[];
    }>(`/pos/billing/payments/${paymentId}/retry-fiscal/`);
  }

  async openFiscalShift(payload?: { cashDeskId?: string }) {
    return apiPost<Record<string, unknown>>('/pos/billing/fiscal-shifts/open/', payload ?? {});
  }

  async closeFiscalShift(payload?: { cashDeskId?: string }) {
    return apiPost<Record<string, unknown>>('/pos/billing/fiscal-shifts/close/', payload ?? {});
  }

  async refundPayment(paymentId: string, reason = '') {
    return apiPost<{ refund: unknown; receipt: CashierReceipt | null }>(`/pos/billing/${paymentId}/refund/`, {
      reason,
    });
  }

  async reprintReceipt(receiptId: string) {
    return apiPost<{ receipt: CashierReceipt | null; result?: Record<string, unknown> }>(
      `/pos/billing/receipts/${receiptId}/reprint/`,
    );
  }
}

export const cashierRepository: CashierRepository = new CashierRepositoryImpl();
