import { useMutation } from '@tanstack/react-query';

import { enqueueEdgePrintDocuments, requestEdgePrintDocuments } from 'modules/edge-printing/application';
import { invalidateQueriesInBackground } from 'shared/api/query-client';
import type { PosModifierSelection } from 'shared/pos/modifiers';

import { cashierRepository } from '../data-access';
import type { CashierMenuItem, CashierShiftCloseResponse, PaymentMethod } from '../domain';

import { cashierKeys } from './keys';

export function useAddCashierOrderItemMutation(options: {
  currentOrderId?: string;
  kitchenNote: string;
  onSuccess?: () => void;
  onPrintError?: (error: unknown) => void;
}) {
  const { currentOrderId, kitchenNote, onSuccess, onPrintError } = options;

  return useMutation({
    mutationFn: async (menuItem: CashierMenuItem) => {
      let orderId = currentOrderId;

      if (!orderId) {
        const createdOrder = await cashierRepository.createTakeawayOrder(kitchenNote);
        orderId = createdOrder.id;
      }

      const result = await cashierRepository.addOrderItem(orderId, menuItem.id, kitchenNote);
      requestEdgePrintDocuments(result?.kitchenPrintDocuments ?? [], onPrintError);
      return result;
    },
    onSuccess: () => {
      invalidateQueriesInBackground([cashierKeys.builderOrders]);
      onSuccess?.();
    },
  });
}

export function useRemoveCashierOrderItemMutation(options: {
  onSuccess?: () => void;
  onPrintError?: (error: unknown) => void;
}) {
  const { onSuccess, onPrintError } = options;

  return useMutation({
    mutationFn: async (itemId: string) => {
      const result = await cashierRepository.removeOrderItem(itemId);
      requestEdgePrintDocuments(result.kitchenPrintDocuments, onPrintError);
      return result;
    },
    onSuccess: () => {
      invalidateQueriesInBackground([cashierKeys.builderOrders]);
      onSuccess?.();
    },
  });
}

export function useCashierOrderScanMutation(options: {
  orderId?: string | null;
  mode: 'add' | 'attach' | 'remove';
  onSuccess?: () => void;
  onPrintError?: (error: unknown) => void;
}) {
  const { orderId, mode, onSuccess, onPrintError } = options;

  return useMutation({
    mutationFn: async (rawCode: string) => {
      if (!orderId) {
        throw new Error('Order id is missing');
      }
      const response = await cashierRepository.scanOrderMarking(orderId, rawCode, mode);
      requestEdgePrintDocuments(response.kitchenPrintDocuments, onPrintError);
      return response;
    },
    onSuccess: ({ order }) => {
      invalidateQueriesInBackground([
        cashierKeys.builderOrders,
        cashierKeys.paymentOrder(order.id),
        ['kitchen', 'queue'],
      ]);
      onSuccess?.();
    },
  });
}

export function useSubmitCashierOrderMutation(options: {
  orderId?: string;
  onSuccess?: () => void;
  onPrintError?: (error: unknown) => void;
}) {
  const { orderId, onSuccess, onPrintError } = options;

  return useMutation({
    mutationFn: async () => {
      if (!orderId) {
        throw new Error('Current order is not available');
      }

      const order = await cashierRepository.submitOrder(orderId);
      requestEdgePrintDocuments(order?.kitchenPrintDocuments ?? [], onPrintError);
      return order;
    },
    onSuccess: () => {
      invalidateQueriesInBackground([
        cashierKeys.builderOrders,
        cashierKeys.checks('open'),
        cashierKeys.checks('closed'),
        ['kitchen', 'queue'],
      ]);
      onSuccess?.();
    },
  });
}

export function useCashierUpdateOrderDisplayNameMutation(options?: { onSuccess?: (orderId: string) => void }) {
  return useMutation({
    mutationFn: async ({ orderId, displayName }: { orderId: string; displayName: string }) =>
      cashierRepository.updateOrderDisplayName(orderId, displayName),
    onSuccess: (order) => {
      invalidateQueriesInBackground([
        cashierKeys.builderOrders,
        cashierKeys.checks('open'),
        cashierKeys.checks('closed'),
        cashierKeys.paymentOrder(order.id),
      ]);
      options?.onSuccess?.(order.id);
    },
  });
}

export function useCashierPaymentMutation(options: {
  orderId: string | null;
  onSuccess?: () => void;
  onPrintError?: (error: unknown) => void;
}) {
  const { orderId, onSuccess, onPrintError } = options;

  return useMutation({
    mutationFn: async (payload: {
      method: PaymentMethod;
      amount: number;
      cashAmount?: number;
      cardAmount?: number;
      manualCardOverride?: boolean;
      manualCardReason?: string;
      registerFiscal?: boolean;
      finalTotal?: number;
      totalOverrideReason?: string;
    }) => {
      if (!orderId) {
        throw new Error('Order id is missing');
      }

      const response = await cashierRepository.payOrder(orderId, payload.method, payload.amount, {
        cashAmount: payload.cashAmount,
        cardAmount: payload.cardAmount,
        manualCardOverride: payload.manualCardOverride,
        manualCardReason: payload.manualCardReason,
        registerFiscal: payload.registerFiscal,
        finalTotal: payload.finalTotal,
        totalOverrideReason: payload.totalOverrideReason,
      });
      requestEdgePrintDocuments(
        response.kitchenPrintDocuments ?? response.order.kitchenPrintDocuments ?? [],
        onPrintError,
      );
      return response;
    },
    onSuccess: (_, __) => {
      invalidateQueriesInBackground([
        cashierKeys.context,
        cashierKeys.checks('open'),
        cashierKeys.checks('closed'),
        cashierKeys.checks('fiscal_closed'),
        cashierKeys.builderOrders,
        cashierKeys.paymentOrder(orderId),
        ['kitchen', 'queue'],
      ]);
      onSuccess?.();
    },
  });
}

export function usePrintCashierPrecheckMutation(options?: { onSuccess?: () => void }) {
  return useMutation({
    mutationFn: async (orderId: string) => {
      const response = await cashierRepository.createPrecheckPrintDocument(orderId);
      const { errors } = await enqueueEdgePrintDocuments([response.printDocument]);
      if (errors.length) {
        throw errors[0];
      }
      return response;
    },
    onSuccess: () => options?.onSuccess?.(),
  });
}

export function useAddCashierPaymentOrderItemMutation(options: { orderId: string | null; onSuccess?: () => void }) {
  const { orderId, onSuccess } = options;

  return useMutation({
    mutationFn: async (payload: {
      catalogItemId: string;
      note?: string;
      selectedModifiers?: PosModifierSelection[];
    }) => {
      if (!orderId) {
        throw new Error('Order id is missing');
      }

      await cashierRepository.addOrderItem(
        orderId,
        payload.catalogItemId,
        payload.note ?? '',
        payload.selectedModifiers,
      );
    },
    onSuccess: () => {
      invalidateQueriesInBackground([
        cashierKeys.builderOrders,
        cashierKeys.checks('open'),
        cashierKeys.checks('closed'),
        cashierKeys.checks('fiscal_closed'),
        cashierKeys.paymentOrder(orderId),
        ['kitchen', 'queue'],
      ]);
      onSuccess?.();
    },
  });
}

export function useRemoveCashierPaymentOrderItemMutation(options: {
  orderId: string | null;
  onSuccess?: () => void;
  onPrintError?: (error: unknown) => void;
}) {
  const { orderId, onSuccess, onPrintError } = options;

  return useMutation({
    mutationFn: async (itemId: string) => {
      const result = await cashierRepository.removeOrderItem(itemId);
      requestEdgePrintDocuments(result.kitchenPrintDocuments, onPrintError);
      return result;
    },
    onSuccess: () => {
      invalidateQueriesInBackground([
        cashierKeys.builderOrders,
        cashierKeys.checks('open'),
        cashierKeys.checks('closed'),
        cashierKeys.checks('fiscal_closed'),
        cashierKeys.paymentOrder(orderId),
        ['kitchen', 'queue'],
      ]);
      onSuccess?.();
    },
  });
}

export function useOpenCashierShiftMutation(options?: { onSuccess?: () => void }) {
  return useMutation({
    mutationFn: (payload: { cashDeskId?: string; cashierId?: string; openingCashAmount: number; notesOpen?: string }) =>
      cashierRepository.openShift(payload),
    onSuccess: () => {
      invalidateQueriesInBackground([cashierKeys.context]);
      options?.onSuccess?.();
    },
  });
}

export function useCreateCashExpenseMutation(options?: { onSuccess?: () => void }) {
  return useMutation({
    mutationFn: (payload: Parameters<typeof cashierRepository.createExpense>[0]) =>
      cashierRepository.createExpense(payload),
    onSuccess: (expense) => {
      invalidateQueriesInBackground([cashierKeys.context, cashierKeys.expenses(expense.cashShiftId)]);
      options?.onSuccess?.();
    },
  });
}

export function useVoidCashExpenseMutation(options?: { onSuccess?: () => void }) {
  return useMutation({
    mutationFn: ({ expenseId, reason }: { expenseId: string; reason: string }) =>
      cashierRepository.voidExpense(expenseId, reason),
    onSuccess: (expense) => {
      invalidateQueriesInBackground([cashierKeys.context, cashierKeys.expenses(expense.cashShiftId)]);
      options?.onSuccess?.();
    },
  });
}

export function useCloseCashierShiftMutation(options?: {
  onSuccess?: (response: CashierShiftCloseResponse) => void;
  onError?: (error: unknown) => void;
}) {
  return useMutation({
    mutationFn: (payload: {
      cashShiftId?: string;
      actualClosingCashAmount?: number;
      notesClose?: string;
      closeFiscalShift?: boolean;
    }) => cashierRepository.closeShift(payload),
    onSuccess: (response) => {
      invalidateQueriesInBackground([
        cashierKeys.context,
        cashierKeys.checks('open'),
        cashierKeys.checks('closed'),
        cashierKeys.checks('fiscal_closed'),
        cashierKeys.builderOrders,
      ]);
      options?.onSuccess?.(response);
    },
    onError: (error) => {
      options?.onError?.(error);
    },
  });
}

export function usePrintCashierShiftReportMutation(options?: { onError?: (error: unknown) => void }) {
  return useMutation({
    mutationFn: (payload: { cashShiftId?: string }) => cashierRepository.printShiftReport(payload),
    onError: (error) => options?.onError?.(error),
  });
}

export function useCashierRefundMutation(options?: { onSuccess?: () => void }) {
  return useMutation({
    mutationFn: (payload: { paymentId: string; reason?: string }) =>
      cashierRepository.refundPayment(payload.paymentId, payload.reason),
    onSuccess: () => {
      invalidateQueriesInBackground([
        cashierKeys.context,
        cashierKeys.checks('open'),
        cashierKeys.checks('closed'),
        cashierKeys.checks('fiscal_closed'),
      ]);
      options?.onSuccess?.();
    },
  });
}

export function useCashierEnsurePaymentPrintDocumentMutation() {
  return useMutation({
    mutationFn: (paymentId: string) => cashierRepository.ensurePaymentPrintDocument(paymentId),
  });
}

export function useCashierFiscalRetryMutation(options?: {
  onSuccess?: (response: Awaited<ReturnType<typeof cashierRepository.retryFiscalPayment>>) => void;
  onError?: (error: unknown) => void;
}) {
  return useMutation({
    mutationFn: (paymentId: string) => cashierRepository.retryFiscalPayment(paymentId),
    onSuccess: (response) => {
      invalidateQueriesInBackground([cashierKeys.context, ['cashier', 'checks']]);
      options?.onSuccess?.(response);
    },
    onError: (error) => {
      options?.onError?.(error);
    },
  });
}

export function useOpenFiscalShiftMutation(options?: { onSuccess?: (response: Record<string, unknown>) => void }) {
  return useMutation({
    mutationFn: (payload?: { cashDeskId?: string }) => cashierRepository.openFiscalShift(payload),
    onSuccess: (response) => {
      invalidateQueriesInBackground([cashierKeys.context]);
      options?.onSuccess?.(response);
    },
  });
}

export function useCloseFiscalShiftMutation(options?: { onSuccess?: (response: Record<string, unknown>) => void }) {
  return useMutation({
    mutationFn: (payload?: { cashDeskId?: string }) => cashierRepository.closeFiscalShift(payload),
    onSuccess: (response) => {
      invalidateQueriesInBackground([cashierKeys.context, ['cashier', 'checks']]);
      options?.onSuccess?.(response);
    },
  });
}
