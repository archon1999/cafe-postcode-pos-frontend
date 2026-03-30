import { useQuery } from '@tanstack/react-query';

import { cashierRepository } from '../data-access';

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
  });
}

export function useCashierOpenChecksQuery(
  status: 'open' | 'closed' = 'open',
  options?: { enabled?: boolean; retry?: boolean },
) {
  return useQuery({
    queryKey: cashierKeys.checks(status),
    queryFn: () => cashierRepository.getOpenChecks(status),
    enabled: options?.enabled,
    retry: options?.retry,
    refetchInterval: 10000,
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
    select: (orders) => orders.length,
  });
}
