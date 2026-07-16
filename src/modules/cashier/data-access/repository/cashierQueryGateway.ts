import type {
  CashierCheckStatus,
  CashierChecksParams,
  CashierChecksResult,
  CashierContext,
  CashierMenuCategory,
  CashierOrder,
} from 'modules/cashier/domain';
import { apiGet, unwrapCollection } from 'shared/api/client';

import { mapCashierMenuCategories, mapCashierOrder, mapCashierOrders } from '../mappers';

type CollectionPayload<T> = T[] | { data?: T[] };
type ChecksPayload<T> =
  | T[]
  | {
      data?: T[];
      count?: number;
      page?: number;
      pageSize?: number;
      numPages?: number;
    };

export const cashierQueryGateway = {
  getCashierContext() {
    return apiGet<CashierContext>('/pos/billing/context/');
  },

  async getMenu(): Promise<CashierMenuCategory[]> {
    return mapCashierMenuCategories(
      unwrapCollection(await apiGet<CollectionPayload<CashierMenuCategory>>('/pos/catalog/menu/')),
    );
  },

  async getOpenOrders(): Promise<CashierOrder[]> {
    return mapCashierOrders(
      unwrapCollection(await apiGet<CollectionPayload<CashierOrder>>('/pos/sales/orders/?status=open')),
    );
  },

  async getOpenChecks(status: CashierCheckStatus = 'open', params?: CashierChecksParams): Promise<CashierChecksResult> {
    const query = new URLSearchParams({ status });
    if (params?.search) {
      query.set('search', params.search);
    }
    if (params?.page) {
      query.set('page', String(params.page));
    }
    if (params?.pageSize) {
      query.set('pageSize', String(params.pageSize));
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
      pageSize: Number(payload.pageSize ?? orders.length),
      numPages: Number(payload.numPages ?? 1),
    };
  },

  async getOrder(orderId: string): Promise<CashierOrder> {
    return mapCashierOrder(await apiGet<CashierOrder>(`/pos/sales/orders/${orderId}/`));
  },
};
