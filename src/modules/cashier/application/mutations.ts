import { useMutation } from '@tanstack/react-query';

import { queryClient } from 'shared/api/query-client';

import { cashierRepository } from '../data-access';
import type { CashierMenuItem, PaymentMethod } from '../domain';

import { cashierKeys } from './keys';

export function useAddCashierOrderItemMutation(options: {
  currentOrderId?: string;
  kitchenNote: string;
  onSuccess?: () => void;
}) {
  const { currentOrderId, kitchenNote, onSuccess } = options;

  return useMutation({
    mutationFn: async (menuItem: CashierMenuItem) => {
      let orderId = currentOrderId;

      if (!orderId) {
        const createdOrder = await cashierRepository.createTakeawayOrder(kitchenNote);
        orderId = createdOrder.id;
      }

      await cashierRepository.addOrderItem(orderId, menuItem.id, kitchenNote);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: cashierKeys.builderOrders });
      onSuccess?.();
    },
  });
}

export function useRemoveCashierOrderItemMutation(options: { onSuccess?: () => void }) {
  const { onSuccess } = options;

  return useMutation({
    mutationFn: async (itemId: string) => {
      await cashierRepository.removeOrderItem(itemId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: cashierKeys.builderOrders });
      onSuccess?.();
    },
  });
}

export function useSubmitCashierOrderMutation(options: { orderId?: string; onSuccess?: () => void }) {
  const { orderId, onSuccess } = options;

  return useMutation({
    mutationFn: async () => {
      if (!orderId) {
        throw new Error('Current order is not available');
      }

      await cashierRepository.submitOrder(orderId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: cashierKeys.builderOrders });
      await queryClient.invalidateQueries({ queryKey: cashierKeys.checks('open') });
      await queryClient.invalidateQueries({ queryKey: cashierKeys.checks('closed') });
      await queryClient.invalidateQueries({ queryKey: ['kitchen', 'queue'] });
      onSuccess?.();
    },
  });
}

export function useCashierUpdateOrderDisplayNameMutation(options?: { onSuccess?: (orderId: string) => void }) {
  return useMutation({
    mutationFn: async ({ orderId, displayName }: { orderId: string; displayName: string }) =>
      cashierRepository.updateOrderDisplayName(orderId, displayName),
    onSuccess: async (order) => {
      await queryClient.invalidateQueries({ queryKey: cashierKeys.builderOrders });
      await queryClient.invalidateQueries({ queryKey: cashierKeys.checks('open') });
      await queryClient.invalidateQueries({ queryKey: cashierKeys.checks('closed') });
      await queryClient.invalidateQueries({ queryKey: cashierKeys.paymentOrder(order.id) });
      options?.onSuccess?.(order.id);
    },
  });
}

export function useCashierPaymentMutation(options: { orderId: string | null; onSuccess?: () => void }) {
  const { orderId, onSuccess } = options;

  return useMutation({
    mutationFn: async (payload: {
      method: PaymentMethod;
      amount: number;
      manualCardOverride?: boolean;
      manualCardReason?: string;
    }) => {
      if (!orderId) {
        throw new Error('Order id is missing');
      }

      return cashierRepository.payOrder(orderId, payload.method, payload.amount, {
        manualCardOverride: payload.manualCardOverride,
        manualCardReason: payload.manualCardReason,
      });
    },
    onSuccess: async (_, __) => {
      await queryClient.invalidateQueries({ queryKey: cashierKeys.context });
      await queryClient.invalidateQueries({ queryKey: cashierKeys.checks('open') });
      await queryClient.invalidateQueries({ queryKey: cashierKeys.checks('closed') });
      await queryClient.invalidateQueries({ queryKey: cashierKeys.builderOrders });
      await queryClient.invalidateQueries({ queryKey: cashierKeys.paymentOrder(orderId) });
      await queryClient.invalidateQueries({ queryKey: ['kitchen', 'queue'] });
      onSuccess?.();
    },
  });
}

export function useAddCashierPaymentOrderItemMutation(options: { orderId: string | null; onSuccess?: () => void }) {
  const { orderId, onSuccess } = options;

  return useMutation({
    mutationFn: async (payload: { catalogItemId: string; note?: string }) => {
      if (!orderId) {
        throw new Error('Order id is missing');
      }

      await cashierRepository.addOrderItem(orderId, payload.catalogItemId, payload.note ?? '');
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: cashierKeys.builderOrders });
      await queryClient.invalidateQueries({ queryKey: cashierKeys.checks('open') });
      await queryClient.invalidateQueries({ queryKey: cashierKeys.checks('closed') });
      await queryClient.invalidateQueries({ queryKey: cashierKeys.paymentOrder(orderId) });
      await queryClient.invalidateQueries({ queryKey: ['kitchen', 'queue'] });
      onSuccess?.();
    },
  });
}

export function useRemoveCashierPaymentOrderItemMutation(options: { orderId: string | null; onSuccess?: () => void }) {
  const { orderId, onSuccess } = options;

  return useMutation({
    mutationFn: async (itemId: string) => {
      await cashierRepository.removeOrderItem(itemId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: cashierKeys.builderOrders });
      await queryClient.invalidateQueries({ queryKey: cashierKeys.checks('open') });
      await queryClient.invalidateQueries({ queryKey: cashierKeys.checks('closed') });
      await queryClient.invalidateQueries({ queryKey: cashierKeys.paymentOrder(orderId) });
      await queryClient.invalidateQueries({ queryKey: ['kitchen', 'queue'] });
      onSuccess?.();
    },
  });
}

export function useOpenCashierShiftMutation(options?: { onSuccess?: () => void }) {
  return useMutation({
    mutationFn: (payload: { cashDeskId?: string; openingCashAmount: number; notesOpen?: string }) =>
      cashierRepository.openShift(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: cashierKeys.context });
      options?.onSuccess?.();
    },
  });
}

export function useCloseCashierShiftMutation(options?: { onSuccess?: () => void }) {
  return useMutation({
    mutationFn: (payload: { actualClosingCashAmount: number; notesClose?: string }) =>
      cashierRepository.closeShift(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: cashierKeys.context });
      await queryClient.invalidateQueries({ queryKey: cashierKeys.checks('open') });
      await queryClient.invalidateQueries({ queryKey: cashierKeys.checks('closed') });
      await queryClient.invalidateQueries({ queryKey: cashierKeys.builderOrders });
      options?.onSuccess?.();
    },
  });
}

export function useCashierRefundMutation(options?: { onSuccess?: () => void }) {
  return useMutation({
    mutationFn: (payload: { paymentId: string; reason?: string }) =>
      cashierRepository.refundPayment(payload.paymentId, payload.reason),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: cashierKeys.context });
      await queryClient.invalidateQueries({ queryKey: cashierKeys.checks('open') });
      await queryClient.invalidateQueries({ queryKey: cashierKeys.checks('closed') });
      options?.onSuccess?.();
    },
  });
}

export function useCashierReprintMutation(options?: { onSuccess?: () => void }) {
  return useMutation({
    mutationFn: (receiptId: string) => cashierRepository.reprintReceipt(receiptId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: cashierKeys.context });
      await queryClient.invalidateQueries({ queryKey: cashierKeys.checks('closed') });
      options?.onSuccess?.();
    },
  });
}
