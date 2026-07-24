import type { CashierCheckStatus, CashierChecksParams } from '../domain';

export const cashierKeys = {
  context: ['cashier', 'context'] as const,
  expenses: (cashShiftId?: string) => ['cashier', 'expenses', cashShiftId ?? 'current'] as const,
  menu: ['cashier', 'menu'] as const,
  builderOrders: ['cashier', 'builder-orders'] as const,
  checks: (status: CashierCheckStatus, params?: CashierChecksParams) =>
    ['cashier', 'checks', status, params?.search ?? '', params?.page ?? 1, params?.pageSize ?? 25] as const,
  paymentOrder: (orderId: string | null) => ['cashier', 'payment-order', orderId] as const,
};
