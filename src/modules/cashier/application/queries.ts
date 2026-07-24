import { useQuery } from '@tanstack/react-query';

import { cashierRepository } from '../data-access';
import type { CashierCheckStatus, CashierChecksParams } from '../domain';

import { cashierKeys } from './keys';

export function useCashierContextQuery(options?: { enabled?: boolean; refetchInterval?: number | false }) {
  return useQuery({
    queryKey: cashierKeys.context,
    queryFn: () => cashierRepository.getCashierContext(),
    enabled: options?.enabled,
    refetchInterval: options?.refetchInterval,
    retry: false,
  });
}

export function useCashExpensesQuery(cashShiftId?: string, enabled = true) {
  return useQuery({
    queryKey: cashierKeys.expenses(cashShiftId),
    queryFn: () => cashierRepository.getExpenses(cashShiftId),
    enabled,
  });
}

export function useCashierMenuQuery() {
  return useQuery({
    queryKey: cashierKeys.menu,
    queryFn: () => cashierRepository.getMenu(),
  });
}

export function useCashierBuilderOrdersQuery() {
  return useQuery({
    queryKey: cashierKeys.builderOrders,
    queryFn: () => cashierRepository.getOpenOrders(),
    refetchInterval: 2000,
    refetchIntervalInBackground: false,
  });
}

export function useCashierOpenChecksQuery(
  status: CashierCheckStatus = 'open',
  params?: CashierChecksParams,
  options?: { enabled?: boolean; retry?: boolean; refetchInterval?: number | false },
) {
  return useQuery({
    queryKey: cashierKeys.checks(status, params),
    queryFn: () => cashierRepository.getOpenChecks(status, params),
    enabled: options?.enabled,
    retry: options?.retry,
    refetchInterval: options?.refetchInterval ?? 2000,
    refetchIntervalInBackground: false,
  });
}

export function useCashierPaymentOrderQuery(orderId: string | null) {
  return useQuery({
    queryKey: cashierKeys.paymentOrder(orderId),
    enabled: Boolean(orderId),
    queryFn: () => cashierRepository.getOrder(orderId as string),
  });
}

export function useCashierOpenChecksCountQuery(enabled: boolean) {
  return useQuery({
    queryKey: cashierKeys.checks('open'),
    queryFn: () => cashierRepository.getOpenChecks('open'),
    enabled,
    retry: false,
    select: (result) => result.count,
  });
}
