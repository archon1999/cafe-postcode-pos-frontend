// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const scanOrderMarkingMock = vi.hoisted(() => vi.fn());
const removeOrderItemMock = vi.hoisted(() => vi.fn());
const payOrderMock = vi.hoisted(() => vi.fn());
const requestEdgePrintDocumentsMock = vi.hoisted(() => vi.fn());
const invalidateQueriesInBackgroundMock = vi.hoisted(() => vi.fn());

vi.mock('../data-access', () => ({
  cashierRepository: {
    removeOrderItem: removeOrderItemMock,
    payOrder: payOrderMock,
    scanOrderMarking: scanOrderMarkingMock,
  },
}));

vi.mock('modules/edge-printing/application', () => ({
  enqueueEdgePrintDocuments: vi.fn(),
  requestEdgePrintDocuments: requestEdgePrintDocumentsMock,
}));

vi.mock('shared/api/query-client', () => ({
  invalidateQueriesInBackground: invalidateQueriesInBackgroundMock,
}));

import {
  useCashierOrderScanMutation,
  useCashierPaymentMutation,
  useRemoveCashierOrderItemMutation,
  useRemoveCashierPaymentOrderItemMutation,
} from './mutations';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useCashierOrderScanMutation', () => {
  beforeEach(() => {
    scanOrderMarkingMock.mockReset();
    removeOrderItemMock.mockReset();
    payOrderMock.mockReset();
    requestEdgePrintDocumentsMock.mockReset();
    invalidateQueriesInBackgroundMock.mockReset();
  });

  it('queues top-level kitchen documents and invalidates using the mapped order', async () => {
    const onPrintError = vi.fn();
    scanOrderMarkingMock.mockResolvedValue({
      order: { id: 'order-1' },
      kitchenPrintDocuments: ['cancel-old-line', 'dispatch-replacement-line'],
    });
    const { result } = renderHook(
      () =>
        useCashierOrderScanMutation({
          orderId: 'order-1',
          mode: 'remove',
          onPrintError,
        }),
      { wrapper: createWrapper() },
    );

    await act(async () => {
      await result.current.mutateAsync('0101234567890121');
    });

    expect(scanOrderMarkingMock).toHaveBeenCalledWith('order-1', '0101234567890121', 'remove');
    expect(requestEdgePrintDocumentsMock).toHaveBeenCalledWith(
      ['cancel-old-line', 'dispatch-replacement-line'],
      onPrintError,
    );
    expect(invalidateQueriesInBackgroundMock).toHaveBeenCalledWith([
      ['cashier', 'builder-orders'],
      ['cashier', 'payment-order', 'order-1'],
      ['kitchen', 'queue'],
    ]);
  });

  it('queues cancellation documents returned by a builder item delete', async () => {
    const onPrintError = vi.fn();
    removeOrderItemMock.mockResolvedValue({
      kitchenPrintDocuments: ['cancel-document-builder'],
    });
    const { result } = renderHook(() => useRemoveCashierOrderItemMutation({ onPrintError }), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync('item-1');
    });

    expect(removeOrderItemMock).toHaveBeenCalledWith('item-1');
    expect(requestEdgePrintDocumentsMock).toHaveBeenCalledWith(['cancel-document-builder'], onPrintError);
  });

  it('queues cancellation documents returned by a payment item delete', async () => {
    const onPrintError = vi.fn();
    removeOrderItemMock.mockResolvedValue({
      kitchenPrintDocuments: ['cancel-document-payment'],
    });
    const { result } = renderHook(
      () =>
        useRemoveCashierPaymentOrderItemMutation({
          orderId: 'order-1',
          onPrintError,
        }),
      { wrapper: createWrapper() },
    );

    await act(async () => {
      await result.current.mutateAsync('item-2');
    });

    expect(removeOrderItemMock).toHaveBeenCalledWith('item-2');
    expect(requestEdgePrintDocumentsMock).toHaveBeenCalledWith(['cancel-document-payment'], onPrintError);
  });

  it('invalidates the halls projection after a successful payment', async () => {
    payOrderMock.mockResolvedValue({
      order: { id: 'order-1', kitchenPrintDocuments: [] },
      kitchenPrintDocuments: [],
    });
    const { result } = renderHook(() => useCashierPaymentMutation({ orderId: 'order-1' }), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({ method: 'cash', amount: 11000, registerFiscal: false });
    });

    expect(invalidateQueriesInBackgroundMock).toHaveBeenCalledWith(expect.arrayContaining([['waiter', 'halls']]));
  });
});
