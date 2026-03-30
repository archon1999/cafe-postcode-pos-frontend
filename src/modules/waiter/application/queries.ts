import { useQuery } from '@tanstack/react-query';

import { waiterRepository } from '../data-access';
import { getCurrentWaiterOrder, getCurrentWaiterTakeawayOrder } from '../domain';

import { waiterKeys } from './keys';

export function useWaiterHallsQuery() {
  return useQuery({
    queryKey: waiterKeys.halls,
    queryFn: () => waiterRepository.getHalls(),
    refetchInterval: 10000,
    refetchIntervalInBackground: false,
  });
}

export function useWaiterMenuQuery() {
  return useQuery({
    queryKey: waiterKeys.menu,
    queryFn: () => waiterRepository.getMenu(),
  });
}

export function useWaiterTableSessionQuery(sessionId: string | null) {
  return useQuery({
    queryKey: waiterKeys.tableSession(sessionId),
    enabled: Boolean(sessionId),
    queryFn: () => waiterRepository.getTableSession(sessionId as string),
  });
}

export function useWaiterOrdersQuery() {
  return useQuery({
    queryKey: waiterKeys.orders,
    queryFn: () => waiterRepository.getOrders(),
  });
}

export function useWaiterSessionOrdersQuery(sessionId: string | null) {
  const query = useWaiterOrdersQuery();

  return {
    ...query,
    data: (query.data ?? []).filter((order) => order.tableSession === sessionId),
  };
}

export function useCurrentWaiterOrder(sessionId: string | null) {
  const query = useWaiterSessionOrdersQuery(sessionId);

  return {
    ...query,
    currentOrder: getCurrentWaiterOrder(query.data, sessionId),
  };
}

export function useWaiterTakeawayOrdersQuery(userId: string | undefined) {
  const query = useWaiterOrdersQuery();

  return {
    ...query,
    data: (query.data ?? []).filter(
      (order) =>
        !order.tableSession &&
        order.channel === 'takeaway' &&
        order.openedBy === userId &&
        !['closed', 'cancelled'].includes(order.status),
    ),
  };
}

export function useCurrentWaiterTakeawayOrder(userId: string | undefined) {
  const query = useWaiterTakeawayOrdersQuery(userId);

  return {
    ...query,
    currentOrder: getCurrentWaiterTakeawayOrder(query.data, userId),
  };
}
