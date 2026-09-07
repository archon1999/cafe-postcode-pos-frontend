import { useQuery } from '@tanstack/react-query';

import { cashierRepository } from '../data-access';
import type { CashierCheckStatus, CashierChecksParams } from '../domain';

import { cashierKeys } from './keys';

export function useCashierContextQuery(options?: {
  enabled?: boolean;
  refetchInterval?: number | false;
  refreshClosingShifts?: boolean;
}) {
  return useQuery({
    queryKey: cashierKeys.context,
    queryFn: () => cashierRepository.getCashierContext(),
    enabled: options?.enabled,
    refetchInterval: (query) => {
      if (options?.refreshClosingShifts && options.refetchInterval !== false) {
        const context = query.state.data;
        const shifts = [
          context?.currentShift,
          ...(context?.activeShifts ?? []),
          ...(context?.pendingClosedShifts ?? []),
        ];
        const awaitingClose = shifts.some(
          (shift) =>
            shift &&
            (shift.syncState === 'pending' ||
              shift.status === 'closing' ||
              shift.status === 'closed-local' ||
              shift.status === 'closed_local' ||
              ['draining', 'fiscal_closing', 'fiscal_unknown', 'closed_local'].includes(shift.closeState ?? '')),
        );
        if (awaitingClose) return 2_000;
      }
      return options?.refetchInterval;
    },
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
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
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
    refetchInterval: 2_000,
    refetchIntervalInBackground: false,
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
