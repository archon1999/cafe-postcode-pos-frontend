import { useQuery } from '@tanstack/react-query';

import { kitchenRepository } from '../data-access';

import { kitchenKeys } from './keys';

export function useKitchenQueueQuery() {
  return useQuery({
    queryKey: kitchenKeys.queue,
    queryFn: () => kitchenRepository.getQueue(),
    refetchInterval: 10000,
    refetchIntervalInBackground: false,
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
