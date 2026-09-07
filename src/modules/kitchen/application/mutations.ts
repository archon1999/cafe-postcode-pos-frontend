import { useMutation } from '@tanstack/react-query';

import { queryClient } from 'shared/api/query-client';

import { kitchenRepository } from '../data-access';
import type { KitchenItemStatus, KitchenTicketStatus } from '../domain';

import { kitchenKeys } from './keys';

async function invalidateKitchenRelatedQueries() {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: kitchenKeys.queue }),
    queryClient.invalidateQueries({ queryKey: ['waiter', 'session-orders'] }),
    queryClient.invalidateQueries({ queryKey: ['cashier', 'open-checks'] }),
    queryClient.invalidateQueries({ queryKey: ['cashier', 'payment-order'] }),
  ]);
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
    mutationFn: ({
      itemId,
      status,
      inventoryDisposition,
    }: {
      itemId: string;
      status: KitchenItemStatus;
      inventoryDisposition?: import('shared/pos/inventory').InventoryDisposition;
    }) => kitchenRepository.updateItemStatus(itemId, status, inventoryDisposition),
    onSuccess: invalidateKitchenRelatedQueries,
  });
}

export function useReplayKitchenAnnouncementMutation() {
  return useMutation({
    mutationFn: ({ ticketId }: { ticketId: string }) => kitchenRepository.replayTicketAnnouncement(ticketId),
  });
}
