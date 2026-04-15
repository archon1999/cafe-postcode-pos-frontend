import { useMutation } from '@tanstack/react-query';

import { queryClient } from 'shared/api/query-client';

import { waiterRepository } from '../data-access';
import type { DiningTable, WaiterMenuItem, WaiterPrintPrebillResponse } from '../domain';
import { clampGuestCount } from '../domain';

import { waiterKeys } from './keys';

export function useOpenTableSessionMutation(options: {
  selectedTable: DiningTable | null;
  guestCount: number;
  onSuccess?: (sessionId: string) => void;
}) {
  const { selectedTable, guestCount, onSuccess } = options;

  return useMutation({
    mutationFn: async () => {
      if (!selectedTable) {
        throw new Error('Dining table is not selected');
      }

      return waiterRepository.openTableSession(selectedTable.id, clampGuestCount(guestCount, selectedTable.seatCount));
    },
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: waiterKeys.halls });
      onSuccess?.(response.id);
    },
  });
}

export function useReserveTableMutation(options: { selectedTable: DiningTable | null; onSuccess?: () => void }) {
  const { selectedTable, onSuccess } = options;

  return useMutation({
    mutationFn: async () => {
      if (!selectedTable) {
        throw new Error('Dining table is not selected');
      }

      await waiterRepository.reserveTable(selectedTable.id);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: waiterKeys.halls });
      onSuccess?.();
    },
  });
}

export function useAddWaiterOrderItemMutation(options: {
  currentOrderId?: string;
  sessionId: string | null;
  createMode?: 'hall' | 'takeaway';
  kitchenNote: string;
  onSuccess?: () => void;
}) {
  const { currentOrderId, sessionId, kitchenNote, onSuccess, createMode = 'hall' } = options;

  return useMutation({
    mutationFn: async (menuItem: WaiterMenuItem) => {
      if (!sessionId && createMode === 'hall') {
        throw new Error('Table session id is missing');
      }

      let orderId = currentOrderId;

      if (!orderId) {
        const createdOrder =
          createMode === 'takeaway'
            ? await waiterRepository.createTakeawayOrder(kitchenNote)
            : await waiterRepository.createOrder(sessionId as string, kitchenNote);
        orderId = createdOrder.id;
      }

      await waiterRepository.addOrderItem(orderId, menuItem.id, kitchenNote);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: waiterKeys.orders });
      if (sessionId) {
        await queryClient.invalidateQueries({ queryKey: waiterKeys.sessionOrders(sessionId) });
      }
      onSuccess?.();
    },
  });
}

export function useRemoveWaiterOrderItemMutation(options: { sessionId: string | null; onSuccess?: () => void }) {
  const { sessionId, onSuccess } = options;

  return useMutation({
    mutationFn: async (itemId: string) => {
      await waiterRepository.removeOrderItem(itemId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: waiterKeys.orders });
      if (sessionId) {
        await queryClient.invalidateQueries({ queryKey: waiterKeys.sessionOrders(sessionId) });
      }
      onSuccess?.();
    },
  });
}

export function useSubmitWaiterOrderMutation(options: {
  orderId?: string;
  sessionId: string | null;
  onSuccess?: () => void;
}) {
  const { orderId, sessionId, onSuccess } = options;

  return useMutation({
    mutationFn: async () => {
      if (!orderId) {
        throw new Error('Current order is not available');
      }

      await waiterRepository.submitOrder(orderId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: waiterKeys.orders });
      if (sessionId) {
        await queryClient.invalidateQueries({ queryKey: waiterKeys.sessionOrders(sessionId) });
      }
      await queryClient.invalidateQueries({ queryKey: ['cashier', 'checks', 'open'] });
      await queryClient.invalidateQueries({ queryKey: ['kitchen', 'queue'] });
      onSuccess?.();
    },
  });
}

export function usePrintWaiterPrebillMutation(options: {
  sessionId: string | null;
  onSuccess?: (response: WaiterPrintPrebillResponse) => void;
}) {
  const { sessionId, onSuccess } = options;

  return useMutation({
    mutationFn: async (orderId: string) => {
      return waiterRepository.printPrebill(orderId);
    },
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: waiterKeys.orders });
      if (sessionId) {
        await queryClient.invalidateQueries({ queryKey: waiterKeys.sessionOrders(sessionId) });
      }
      await queryClient.invalidateQueries({ queryKey: ['cashier', 'checks', 'open'] });
      onSuccess?.(response);
    },
  });
}
