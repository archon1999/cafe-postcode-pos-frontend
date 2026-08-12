import { useMutation } from '@tanstack/react-query';

import { enqueueEdgePrintDocuments, requestEdgePrintDocuments } from 'modules/edge-printing/application';
import { invalidateQueriesInBackground } from 'shared/api/query-client';

import { waiterRepository } from '../data-access';
import type { DiningTable, WaiterMenuItem } from '../domain';
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
    onSuccess: (response) => {
      invalidateQueriesInBackground([waiterKeys.halls]);
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
    onSuccess: () => {
      invalidateQueriesInBackground([waiterKeys.halls]);
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
  onPrintError?: (error: unknown) => void;
}) {
  const { currentOrderId, sessionId, kitchenNote, onSuccess, onPrintError, createMode = 'hall' } = options;

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

      const result = await waiterRepository.addOrderItem(orderId, menuItem.id, kitchenNote);
      requestEdgePrintDocuments(result?.kitchenPrintDocuments ?? [], onPrintError);
      return result;
    },
    onSuccess: () => {
      invalidateQueriesInBackground([waiterKeys.orders, ...(sessionId ? [waiterKeys.sessionOrders(sessionId)] : [])]);
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
    onSuccess: () => {
      invalidateQueriesInBackground([waiterKeys.orders, ...(sessionId ? [waiterKeys.sessionOrders(sessionId)] : [])]);
      onSuccess?.();
    },
  });
}

export function useSubmitWaiterOrderMutation(options: {
  orderId?: string;
  sessionId: string | null;
  orderNote: string;
  onSuccess?: () => void;
  onPrintError?: (error: unknown) => void;
}) {
  const { orderId, sessionId, orderNote, onSuccess, onPrintError } = options;

  return useMutation({
    mutationFn: async () => {
      if (!orderId) {
        throw new Error('Current order is not available');
      }

      await waiterRepository.updateOrderNote(orderId, orderNote);
      const order = await waiterRepository.submitOrder(orderId);
      requestEdgePrintDocuments(order?.kitchenPrintDocuments ?? [], onPrintError);
      return order;
    },
    onSuccess: () => {
      invalidateQueriesInBackground([
        waiterKeys.orders,
        ...(sessionId ? [waiterKeys.sessionOrders(sessionId)] : []),
        ['cashier', 'checks', 'open'],
        ['kitchen', 'queue'],
      ]);
      onSuccess?.();
    },
  });
}

export function usePrintWaiterPrecheckMutation(options: {
  orderId?: string;
  orderNote: string;
  onSuccess?: () => void;
}) {
  const { orderId, orderNote, onSuccess } = options;

  return useMutation({
    mutationFn: async () => {
      if (!orderId) {
        throw new Error('Current order is not available');
      }

      await waiterRepository.updateOrderNote(orderId, orderNote);
      const response = await waiterRepository.createPrecheckPrintDocument(orderId);
      const { errors } = await enqueueEdgePrintDocuments([response.printDocument]);
      if (errors.length) {
        throw errors[0];
      }
      return response;
    },
    onSuccess,
  });
}
