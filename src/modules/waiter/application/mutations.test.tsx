// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const removeOrderItemMock = vi.hoisted(() => vi.fn());
const createPrecheckPrintDocumentMock = vi.hoisted(() => vi.fn());
const updateOrderNoteMock = vi.hoisted(() => vi.fn());
const enqueueEdgePrintDocumentsMock = vi.hoisted(() => vi.fn());
const requestEdgePrintDocumentsMock = vi.hoisted(() => vi.fn());
const invalidateQueriesInBackgroundMock = vi.hoisted(() => vi.fn());

vi.mock('../data-access', () => ({
  waiterRepository: {
    createPrecheckPrintDocument: createPrecheckPrintDocumentMock,
    removeOrderItem: removeOrderItemMock,
    updateOrderNote: updateOrderNoteMock,
  },
}));

vi.mock('modules/edge-printing/application', () => ({
  enqueueEdgePrintDocuments: enqueueEdgePrintDocumentsMock,
  requestEdgePrintDocuments: requestEdgePrintDocumentsMock,
}));

vi.mock('shared/api/query-client', () => ({
  invalidateQueriesInBackground: invalidateQueriesInBackgroundMock,
}));

import { usePrintWaiterPrecheckMutation, useRemoveWaiterOrderItemMutation } from './mutations';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useRemoveWaiterOrderItemMutation', () => {
  beforeEach(() => {
    removeOrderItemMock.mockReset();
    createPrecheckPrintDocumentMock.mockReset();
    updateOrderNoteMock.mockReset();
    enqueueEdgePrintDocumentsMock.mockReset();
    requestEdgePrintDocumentsMock.mockReset();
    invalidateQueriesInBackgroundMock.mockReset();
  });

  it('queues the kitchen cancellation document with print error plumbing', async () => {
    const onPrintError = vi.fn();
    removeOrderItemMock.mockResolvedValue({
      kitchenPrintDocuments: ['cancel-document-waiter'],
    });
    const { result } = renderHook(
      () =>
        useRemoveWaiterOrderItemMutation({
          sessionId: 'session-1',
          onPrintError,
        }),
      { wrapper: createWrapper() },
    );

    await act(async () => {
      await result.current.mutateAsync('item-1');
    });

    expect(removeOrderItemMock).toHaveBeenCalledWith('item-1');
    expect(requestEdgePrintDocumentsMock).toHaveBeenCalledWith(['cancel-document-waiter'], onPrintError);
  });

  it('refreshes hall table state after printing a precheck', async () => {
    updateOrderNoteMock.mockResolvedValue({});
    createPrecheckPrintDocumentMock.mockResolvedValue({ printDocument: 'precheck-document-1' });
    enqueueEdgePrintDocumentsMock.mockResolvedValue({ errors: [] });
    const onSuccess = vi.fn();
    const { result } = renderHook(
      () =>
        usePrintWaiterPrecheckMutation({
          orderId: 'order-1',
          orderNote: '',
          onSuccess,
        }),
      { wrapper: createWrapper() },
    );

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(invalidateQueriesInBackgroundMock).toHaveBeenCalledWith([['waiter', 'halls']]);
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });
});
