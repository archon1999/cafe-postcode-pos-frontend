// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const removeOrderItemMock = vi.hoisted(() => vi.fn());
const requestEdgePrintDocumentsMock = vi.hoisted(() => vi.fn());

vi.mock('../data-access', () => ({
  waiterRepository: {
    removeOrderItem: removeOrderItemMock,
  },
}));

vi.mock('modules/edge-printing/application', () => ({
  enqueueEdgePrintDocuments: vi.fn(),
  requestEdgePrintDocuments: requestEdgePrintDocumentsMock,
}));

vi.mock('shared/api/query-client', () => ({
  invalidateQueriesInBackground: vi.fn(),
}));

import { useRemoveWaiterOrderItemMutation } from './mutations';

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
    requestEdgePrintDocumentsMock.mockReset();
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
});
