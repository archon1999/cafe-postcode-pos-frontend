import { useMutation } from '@tanstack/react-query';

import { queryClient } from 'shared/api/query-client';

import type { KitchenItemStatus, KitchenTicketStatus } from '../domain';

import { kitchenRepository } from '../data-access';
import { kitchenKeys } from './keys';

async function invalidateKitchenRelatedQueries() {
  await queryClient.invalidateQueries({ queryKey: kitchenKeys.queue });
  await queryClient.invalidateQueries({ queryKey: ['waiter', 'session-orders'] });
  await queryClient.invalidateQueries({ queryKey: ['cashier', 'open-checks'] });
  await queryClient.invalidateQueries({ queryKey: ['cashier', 'payment-order'] });
}

export function useUpdateKitchenTicketStatusMutation() {
  return useMutation({
    mutationFn: ({ ticketId, status }: { ticketId: string; status: KitchenTicketStatus }) =>
      kitchenRepository.updateTicketStatus(ticketId, status),
    onSuccess: invalidateKitchenRelatedQueries,
  });
}

export function useUpdateKitchenItemStatusMutation() {
  return useMutation({
    mutationFn: ({ itemId, status }: { itemId: string; status: KitchenItemStatus }) =>
      kitchenRepository.updateItemStatus(itemId, status),
    onSuccess: invalidateKitchenRelatedQueries,
  });
}
