import { useQuery } from '@tanstack/react-query';

import { kitchenRepository } from '../data-access';

import { kitchenKeys } from './keys';

export function useKitchenQueueQuery() {
  return useQuery({
    queryKey: kitchenKeys.queue,
    queryFn: () => kitchenRepository.getQueue(),
    refetchInterval: 2000,
    refetchIntervalInBackground: false,
  });
}

export function useKitchenMonitorQuery(restaurantId: string | null) {
  return useQuery({
    queryKey: kitchenKeys.monitorQueue(restaurantId),
    enabled: Boolean(restaurantId),
    queryFn: () => kitchenRepository.getMonitorQueue(restaurantId as string),
    refetchInterval: 2000,
    refetchIntervalInBackground: true,
  });
}

export function useKitchenActiveTicketCountQuery(enabled: boolean) {
  return useQuery({
    queryKey: kitchenKeys.queue,
    queryFn: () => kitchenRepository.getQueue(),
    enabled,
    retry: false,
    select: (tickets) => tickets.filter((ticket) => ticket.status !== 'done').length,
  });
}
