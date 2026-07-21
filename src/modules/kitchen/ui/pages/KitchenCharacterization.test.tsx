// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  invalidateQueries: vi.fn(),
  print: vi.fn(),
}));

vi.mock('shared/api/client', () => ({
  apiGet: mocks.apiGet,
  apiPost: mocks.apiPost,
  unwrapCollection: (payload: unknown[] | { data?: unknown[] }) =>
    Array.isArray(payload) ? payload : (payload.data ?? []),
}));

vi.mock('shared/api/query-client', () => ({
  queryClient: { invalidateQueries: mocks.invalidateQueries },
}));

vi.mock('modules/edge-printing/data-access', () => ({
  edgePrintRepository: { print: mocks.print },
}));

import { enqueueEdgePrintDocuments, requestEdgePrintDocuments } from 'modules/edge-printing/application';
import {
  useKitchenMonitorQuery,
  useKitchenQueueQuery,
  useUpdateKitchenItemStatusMutation,
  useUpdateKitchenTicketStatusMutation,
} from 'modules/kitchen/application';
import { kitchenRepository } from 'modules/kitchen/data-access';

function createQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
}

function queryWrapper(client = createQueryClient()) {
  return function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('POS kitchen characterization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.invalidateQueries.mockResolvedValue(undefined);
  });

  it('maps queue and restaurant-scoped monitor endpoints into domain objects', async () => {
    mocks.apiGet
      .mockResolvedValueOnce({
        data: [
          {
            id: 'ticket-1',
            orderNumber: 41,
            displayName: '7',
            channel: 'takeaway',
            prepStationName: 'Kitchen',
            status: 'new',
            hallName: null,
            tableName: null,
            items: [{ id: 'item-1', catalogItemName: 'Osh', quantity: 2, lineTotal: 60000, status: 'new' }],
          },
        ],
      })
      .mockResolvedValueOnce({
        preparing: [{ id: 'ticket-1', orderNumber: 41, displayName: '7', status: 'cooking', completedAt: null }],
        recentlyDone: [
          { id: 'ticket-2', orderNumber: 40, displayName: '6', status: 'done', completedAt: '2026-07-15T10:00:00Z' },
        ],
      });

    const queue = await kitchenRepository.getQueue();
    const monitor = await kitchenRepository.getMonitorQueue('restaurant-1');

    expect(mocks.apiGet).toHaveBeenNthCalledWith(1, '/pos/kitchen/queue/');
    expect(mocks.apiGet).toHaveBeenNthCalledWith(2, '/pos/monitor/kitchen-queue/?restaurant_id=restaurant-1');
    expect(queue[0]).toMatchObject({
      id: 'ticket-1',
      orderNumber: 41,
      displayName: '7',
      channel: 'takeaway',
      items: [{ quantity: 2 }],
    });
    expect(monitor).toEqual({
      preparing: [{ id: 'ticket-1', orderNumber: 41, displayName: '7', status: 'cooking', completedAt: null }],
      recentlyDone: [
        { id: 'ticket-2', orderNumber: 40, displayName: '6', status: 'done', completedAt: '2026-07-15T10:00:00Z' },
      ],
    });
  });

  it('keeps queue and monitor queries separate and disables monitor without a restaurant', async () => {
    mocks.apiGet.mockResolvedValueOnce([]);
    const client = createQueryClient();
    const wrapper = queryWrapper(client);
    const queue = renderHook(() => useKitchenQueueQuery(), { wrapper });
    const disabledMonitor = renderHook(() => useKitchenMonitorQuery(null), { wrapper });

    await waitFor(() => expect(queue.result.current.isSuccess).toBe(true));

    expect(queue.result.current.data).toEqual([]);
    expect(disabledMonitor.result.current.fetchStatus).toBe('idle');
    expect(mocks.apiGet).toHaveBeenCalledTimes(1);
    expect(
      (
        client.getQueryCache().find({ queryKey: ['kitchen', 'queue'] })?.options as
          | { refetchInterval?: unknown }
          | undefined
      )?.refetchInterval,
    ).toBe(5000);
    expect(
      (
        client.getQueryCache().find({ queryKey: ['kitchen', 'monitor', null] })?.options as
          | { refetchInterval?: unknown }
          | undefined
      )?.refetchInterval,
    ).toBe(5000);
  });

  it('posts ticket and item status then invalidates every current kitchen consumer', async () => {
    mocks.apiPost.mockResolvedValue(undefined);
    const ticket = renderHook(() => useUpdateKitchenTicketStatusMutation(), { wrapper: queryWrapper() });
    const item = renderHook(() => useUpdateKitchenItemStatusMutation(), { wrapper: queryWrapper() });

    await act(async () => {
      await ticket.result.current.mutateAsync({ ticketId: 'ticket-1', status: 'done' });
      await item.result.current.mutateAsync({ itemId: 'item-1', status: 'cooking' });
    });

    expect(mocks.apiPost).toHaveBeenNthCalledWith(1, '/pos/kitchen/tickets/ticket-1/status/', { status: 'done' });
    expect(mocks.apiPost).toHaveBeenNthCalledWith(2, '/pos/kitchen/items/item-1/status/', { status: 'cooking' });
    expect(mocks.invalidateQueries.mock.calls).toEqual([
      [{ queryKey: ['kitchen', 'queue'] }],
      [{ queryKey: ['waiter', 'session-orders'] }],
      [{ queryKey: ['cashier', 'open-checks'] }],
      [{ queryKey: ['cashier', 'payment-order'] }],
      [{ queryKey: ['kitchen', 'queue'] }],
      [{ queryKey: ['waiter', 'session-orders'] }],
      [{ queryKey: ['cashier', 'open-checks'] }],
      [{ queryKey: ['cashier', 'payment-order'] }],
    ]);
  });

  it('deduplicates document IDs within one enqueue call but keeps failures visible', async () => {
    mocks.print.mockResolvedValueOnce({ operationId: 'print-1' }).mockRejectedValueOnce(new Error('printer offline'));

    const result = await enqueueEdgePrintDocuments(['document-1', '', 'document-1', 'document-2']);

    expect(mocks.print.mock.calls).toEqual([
      [{ documentId: 'document-1', operationId: 'auto:document-1' }],
      [{ documentId: 'document-2', operationId: 'auto:document-2' }],
    ]);
    expect(result.jobs).toEqual([{ operationId: 'print-1' }]);
    expect(result.errors).toHaveLength(1);
  });

  it('starts print enqueueing without making the caller wait for Local Agent', async () => {
    let resolvePrint: ((value: { operationId: string }) => void) | undefined;
    mocks.print.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePrint = resolve;
        }),
    );
    const onError = vi.fn();

    requestEdgePrintDocuments(['document-1'], onError);

    expect(mocks.print).toHaveBeenCalledWith({ documentId: 'document-1', operationId: 'auto:document-1' });
    expect(onError).not.toHaveBeenCalled();
    resolvePrint?.({ operationId: 'print-1' });
    await Promise.resolve();
  });
});
