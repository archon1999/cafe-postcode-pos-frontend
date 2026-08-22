// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react';
import { StrictMode, type PropsWithChildren } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { queryClient } from 'shared/api/query-client';

import { useOptimisticBuilderOrder } from './useOptimisticBuilderOrder';

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}));

type TestMenuItem = {
  id: string;
  name: string;
  prepStationName?: string | null;
  price: number | string;
  saleUnit?: 'piece' | 'kg';
};

type TestOrderItem = {
  id: string;
  catalogItem: string;
  catalogItemName: string;
  quantity: number | string;
  lineTotal: number | string;
  status: string;
  prepStationName?: string | null;
  note?: string | null;
};

type TestOrder = {
  id: string;
  openedBy?: string;
  tableSession?: string | null;
  orderNumber: number;
  status: string;
  subtotal: number | string;
  serviceFee: number | string;
  serviceFeePercent?: number | string;
  vatEnabled?: boolean;
  vatPercent?: number | string;
  vatAmount?: number | string;
  total: number | string;
  note: string;
  channel: string;
  items: TestOrderItem[];
};

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });

  return { promise, resolve, reject };
}

function createMenuItem(overrides: Partial<TestMenuItem> = {}): TestMenuItem {
  return {
    id: 'menu-1',
    name: 'Americano',
    prepStationName: 'Bar',
    price: 12000,
    ...overrides,
  };
}

function createOrderItem(overrides: Partial<TestOrderItem> = {}): TestOrderItem {
  return {
    id: 'item-1',
    catalogItem: 'menu-1',
    catalogItemName: 'Americano',
    quantity: 1,
    lineTotal: 12000,
    status: 'new',
    prepStationName: 'Bar',
    note: '',
    ...overrides,
  };
}

function createOrder(overrides: Partial<TestOrder> = {}): TestOrder {
  return {
    id: 'order-1',
    openedBy: 'user-1',
    tableSession: 'session-1',
    orderNumber: 101,
    status: 'open',
    subtotal: 12000,
    serviceFee: 1200,
    serviceFeePercent: 10,
    total: 13200,
    note: '',
    channel: 'hall',
    items: [createOrderItem()],
    ...overrides,
  };
}

function StrictModeWrapper({ children }: PropsWithChildren) {
  return <StrictMode>{children}</StrictMode>;
}

describe('useOptimisticBuilderOrder', () => {
  beforeEach(() => {
    queryClient.clear();
    vi.clearAllMocks();
  });

  it('creates on the first item and replaces the temporary identity with the canonical order', async () => {
    let canonicalOrders: TestOrder[] = [];
    const createRemoteOrder = vi.fn(async () => 'order-12');
    const addOrderItem = vi.fn(async () => {
      canonicalOrders = [
        createOrder({
          id: 'order-12',
          orderNumber: 12,
          tableSession: null,
          channel: 'delivery',
        }),
      ];
    });

    const { result } = renderHook(() =>
      useOptimisticBuilderOrder<TestMenuItem, TestOrderItem, TestOrder, TestOrder[]>({
        baseOrder: undefined,
        canonicalQueryKey: ['test', 'orders'],
        canonicalQueryFn: async () => canonicalOrders,
        channel: 'delivery',
        createOrder: createRemoteOrder,
        defaultServiceFeePercent: 0,
        removeOrderItem: async () => undefined,
        selectCurrentOrder: (orders) => orders[0],
        addOrderItem,
        syncErrorMessage: 'sync failed',
      }),
    );

    expect(result.current.currentOrder).toBeUndefined();
    expect(createRemoteOrder).not.toHaveBeenCalled();

    act(() => {
      result.current.addItem(createMenuItem(), 'less sugar');
    });

    expect(result.current.currentOrder?.id).toMatch(/^temp-builder-/);
    expect(result.current.currentOrder?.orderNumber).toBe(0);
    expect(result.current.currentOrder?.channel).toBe('delivery');

    await waitFor(() => {
      expect(result.current.hasPendingOperations).toBe(false);
    });

    expect(createRemoteOrder).toHaveBeenCalledTimes(1);
    expect(createRemoteOrder).toHaveBeenCalledWith();
    expect(addOrderItem).toHaveBeenCalledWith(
      'order-12',
      expect.objectContaining({ id: 'menu-1' }),
      'less sugar',
      [],
      undefined,
    );
    expect(result.current.currentOrder?.id).toBe('order-12');
    expect(result.current.currentOrder?.orderNumber).toBe(12);
  });

  it('cancels a temporary item locally without issuing a delete request', async () => {
    const createOrderDeferred = deferred<string>();
    const createOrder = vi.fn(() => createOrderDeferred.promise);
    const addOrderItem = vi.fn(async () => undefined);
    const removeOrderItem = vi.fn(async () => undefined);
    const canonicalOrders: TestOrder[] = [];

    const { result } = renderHook(() =>
      useOptimisticBuilderOrder<TestMenuItem, TestOrderItem, TestOrder, TestOrder[]>({
        baseOrder: undefined,
        canonicalQueryKey: ['test', 'orders'],
        canonicalQueryFn: async () => canonicalOrders,
        channel: 'takeaway',
        createOrder,
        defaultServiceFeePercent: 0,
        removeOrderItem,
        selectCurrentOrder: (orders) => orders[0],
        addOrderItem,
        syncErrorMessage: 'sync failed',
      }),
    );

    act(() => {
      result.current.addItem(createMenuItem(), '');
    });

    const tempItemId = result.current.currentOrder?.items[0]?.id;
    expect(tempItemId).toBeDefined();

    act(() => {
      result.current.removeItem(tempItemId as string);
    });

    createOrderDeferred.resolve('order-1');

    await waitFor(() => {
      expect(result.current.hasPendingOperations).toBe(false);
    });

    expect(addOrderItem).not.toHaveBeenCalled();
    expect(removeOrderItem).not.toHaveBeenCalled();
    expect(result.current.currentOrder).toBeUndefined();
  });

  it('rolls back when the initial order creation fails', async () => {
    const createOrder = vi.fn(async () => {
      throw new Error('offline');
    });

    const { result } = renderHook(() =>
      useOptimisticBuilderOrder<TestMenuItem, TestOrderItem, TestOrder, TestOrder[]>({
        baseOrder: undefined,
        canonicalQueryKey: ['test', 'orders'],
        canonicalQueryFn: async () => [],
        channel: 'takeaway',
        createOrder,
        defaultServiceFeePercent: 0,
        removeOrderItem: async () => undefined,
        selectCurrentOrder: (orders) => orders[0],
        addOrderItem: async () => undefined,
        syncErrorMessage: 'sync failed',
      }),
    );

    act(() => {
      result.current.addItem(createMenuItem(), '');
    });

    expect(result.current.currentOrder?.items).toHaveLength(1);

    await waitFor(() => {
      expect(result.current.hasPendingOperations).toBe(false);
    });

    expect(result.current.currentOrder).toBeUndefined();
  });

  it('rolls back only the failed add operation on an existing order', async () => {
    const baseOrder = createOrder();
    const canonicalOrders = [baseOrder];
    const addOrderItem = vi.fn(async () => {
      throw new Error('offline');
    });

    const { result } = renderHook(() =>
      useOptimisticBuilderOrder<TestMenuItem, TestOrderItem, TestOrder, TestOrder[]>({
        baseOrder,
        canonicalQueryKey: ['test', 'orders'],
        canonicalQueryFn: async () => canonicalOrders,
        channel: 'hall',
        createOrder: async () => baseOrder.id,
        defaultServiceFeePercent: 10,
        removeOrderItem: async () => undefined,
        selectCurrentOrder: (orders) => orders[0],
        addOrderItem,
        syncErrorMessage: 'sync failed',
      }),
    );

    act(() => {
      result.current.addItem(createMenuItem({ id: 'menu-2', name: 'Cake', price: 18000 }), '');
    });

    expect(result.current.currentOrder?.items).toHaveLength(2);

    await waitFor(() => {
      expect(result.current.hasPendingOperations).toBe(false);
    });

    expect(result.current.currentOrder?.items).toHaveLength(1);
    expect(canonicalOrders[0].items).toHaveLength(1);
  });

  it('restores a server-backed item when optimistic delete fails', async () => {
    const baseOrder = createOrder();
    const { result } = renderHook(() =>
      useOptimisticBuilderOrder<TestMenuItem, TestOrderItem, TestOrder, TestOrder[]>({
        baseOrder,
        canonicalQueryKey: ['test', 'orders'],
        canonicalQueryFn: async () => [baseOrder],
        channel: 'hall',
        createOrder: async () => baseOrder.id,
        defaultServiceFeePercent: 10,
        removeOrderItem: async () => {
          throw new Error('offline');
        },
        selectCurrentOrder: (orders) => orders[0],
        addOrderItem: async () => undefined,
        syncErrorMessage: 'sync failed',
      }),
    );

    act(() => {
      result.current.removeItem('item-1');
    });

    expect(result.current.currentOrder?.items).toHaveLength(0);

    await waitFor(() => {
      expect(result.current.hasPendingOperations).toBe(false);
    });

    expect(result.current.currentOrder?.items).toHaveLength(1);
  });

  it('clears the projected order after the final server-backed item is removed successfully', async () => {
    const baseOrder = createOrder({ tableSession: null, channel: 'takeaway' });
    let canonicalOrders = [baseOrder];
    const removeOrderItem = vi.fn(async () => {
      canonicalOrders = [];
    });
    const { result } = renderHook(() =>
      useOptimisticBuilderOrder<TestMenuItem, TestOrderItem, TestOrder, TestOrder[]>({
        baseOrder,
        canonicalQueryKey: ['test', 'orders'],
        canonicalQueryFn: async () => canonicalOrders,
        channel: 'takeaway',
        createOrder: async () => baseOrder.id,
        defaultServiceFeePercent: 0,
        removeOrderItem,
        selectCurrentOrder: (orders) => orders[0],
        addOrderItem: async () => undefined,
        syncErrorMessage: 'sync failed',
      }),
    );

    act(() => {
      result.current.removeItem('item-1');
    });

    expect(result.current.currentOrder?.items).toHaveLength(0);

    await waitFor(() => {
      expect(result.current.hasPendingOperations).toBe(false);
    });

    expect(removeOrderItem).toHaveBeenCalledTimes(1);
    expect(result.current.currentOrder).toBeUndefined();
  });

  it('forwards cancellation documents returned by an optimistic delete', async () => {
    const baseOrder = createOrder({ tableSession: null, channel: 'takeaway' });
    let canonicalOrders = [baseOrder];
    const onPrintDocuments = vi.fn();
    const removeOrderItem = vi.fn(async () => {
      canonicalOrders = [];
      return { kitchenPrintDocuments: ['cancel-document-1'] };
    });
    const { result } = renderHook(() =>
      useOptimisticBuilderOrder<TestMenuItem, TestOrderItem, TestOrder, TestOrder[]>({
        baseOrder,
        canonicalQueryKey: ['test', 'orders'],
        canonicalQueryFn: async () => canonicalOrders,
        channel: 'takeaway',
        createOrder: async () => baseOrder.id,
        defaultServiceFeePercent: 0,
        removeOrderItem,
        onPrintDocuments,
        selectCurrentOrder: (orders) => orders[0],
        addOrderItem: async () => undefined,
        syncErrorMessage: 'sync failed',
      }),
    );

    act(() => {
      result.current.removeItem('item-1');
    });

    await waitFor(() => {
      expect(result.current.hasPendingOperations).toBe(false);
    });

    expect(removeOrderItem).toHaveBeenCalledTimes(1);
    expect(onPrintDocuments).toHaveBeenCalledWith(['cancel-document-1']);
    expect(result.current.currentOrder).toBeUndefined();
  });

  it('resets the removed order identity and notifies the editing flow', async () => {
    const baseOrder = createOrder({ tableSession: null, channel: 'takeaway' });
    const createRemoteOrder = vi.fn(async () => 'replacement-order');
    const onOrderRemoved = vi.fn();
    const { result } = renderHook(() =>
      useOptimisticBuilderOrder<TestMenuItem, TestOrderItem, TestOrder, TestOrder[]>({
        baseOrder,
        canonicalQueryKey: ['test', 'orders'],
        canonicalQueryFn: async () => [baseOrder],
        channel: 'takeaway',
        createOrder: createRemoteOrder,
        defaultServiceFeePercent: 0,
        removeOrderItem: async () => ({ orderRemoved: true }),
        onOrderRemoved,
        selectCurrentOrder: (orders) => orders[0],
        addOrderItem: async () => undefined,
        syncErrorMessage: 'sync failed',
      }),
    );

    act(() => result.current.removeItem('item-1'));

    await waitFor(() => expect(result.current.hasPendingOperations).toBe(false));
    expect(result.current.currentOrder).toBeUndefined();
    expect(onOrderRemoved).toHaveBeenCalledTimes(1);

    act(() => result.current.addItem(createMenuItem({ id: 'menu-2' }), ''));
    await waitFor(() => expect(createRemoteOrder).toHaveBeenCalledWith());
  });

  it('issues only one delete request per remove action in strict mode', async () => {
    const baseOrder = createOrder();
    const removeOrderItem = vi.fn(async () => undefined);

    const { result } = renderHook(
      () =>
        useOptimisticBuilderOrder<TestMenuItem, TestOrderItem, TestOrder, TestOrder[]>({
          baseOrder,
          canonicalQueryKey: ['test', 'orders'],
          canonicalQueryFn: async () => [baseOrder],
          channel: 'hall',
          createOrder: async () => baseOrder.id,
          defaultServiceFeePercent: 10,
          removeOrderItem,
          selectCurrentOrder: (orders) => orders[0],
          addOrderItem: async () => undefined,
          syncErrorMessage: 'sync failed',
        }),
      { wrapper: StrictModeWrapper },
    );

    act(() => {
      result.current.removeItem('item-1');
    });

    await waitFor(() => {
      expect(result.current.hasPendingOperations).toBe(false);
    });

    expect(removeOrderItem).toHaveBeenCalledTimes(1);
  });

  it('keeps later optimistic changes when an earlier queued add fails', async () => {
    const baseOrder = createOrder({ items: [], subtotal: 0, serviceFee: 0, total: 0 });
    let canonicalOrders = [baseOrder];
    const addOrderItem = vi.fn(async (_orderId: string, menuItem: TestMenuItem) => {
      if (menuItem.id === 'menu-1') {
        throw new Error('offline');
      }

      canonicalOrders = [
        {
          ...baseOrder,
          items: [
            createOrderItem({
              id: 'item-2',
              catalogItem: menuItem.id,
              catalogItemName: menuItem.name,
              lineTotal: 18000,
            }),
          ],
          subtotal: 18000,
          serviceFee: 1800,
          total: 19800,
        },
      ];
    });

    const { result } = renderHook(() =>
      useOptimisticBuilderOrder<TestMenuItem, TestOrderItem, TestOrder, TestOrder[]>({
        baseOrder,
        canonicalQueryKey: ['test', 'orders'],
        canonicalQueryFn: async () => canonicalOrders,
        channel: 'hall',
        createOrder: async () => baseOrder.id,
        defaultServiceFeePercent: 10,
        removeOrderItem: async () => undefined,
        selectCurrentOrder: (orders) => orders[0],
        addOrderItem,
        syncErrorMessage: 'sync failed',
      }),
    );

    act(() => {
      result.current.addItem(createMenuItem({ id: 'menu-1', name: 'Americano', price: 12000 }), '');
      result.current.addItem(createMenuItem({ id: 'menu-2', name: 'Cake', price: 18000 }), '');
    });

    expect(result.current.currentOrder?.items).toHaveLength(2);

    await waitFor(() => {
      expect(result.current.hasPendingOperations).toBe(false);
    });

    expect(result.current.currentOrder?.items.map((item) => item.catalogItem)).toEqual(['menu-2']);
    expect(result.current.currentOrder?.total).toBe(19800);
  });

  it('preserves sub-kilogram quantities when adding items in a batch', async () => {
    const baseOrder = createOrder({ items: [], subtotal: 0, serviceFee: 0, total: 0 });
    let canonicalOrders = [baseOrder];
    const addOrderItems = vi.fn(
      async (_orderId: string, items: Array<{ menuItem: TestMenuItem; quantity: number; note: string }>) => {
        const [{ menuItem, quantity }] = items;
        canonicalOrders = [
          createOrder({
            items: [
              createOrderItem({
                catalogItem: menuItem.id,
                catalogItemName: menuItem.name,
                quantity,
                lineTotal: Number(menuItem.price) * quantity,
              }),
            ],
            subtotal: Number(menuItem.price) * quantity,
            serviceFee: 0,
            total: Number(menuItem.price) * quantity,
          }),
        ];
      },
    );

    const { result } = renderHook(() =>
      useOptimisticBuilderOrder<TestMenuItem, TestOrderItem, TestOrder, TestOrder[]>({
        baseOrder,
        canonicalQueryKey: ['test', 'orders'],
        canonicalQueryFn: async () => canonicalOrders,
        channel: 'hall',
        createOrder: async () => baseOrder.id,
        defaultServiceFeePercent: 0,
        removeOrderItem: async () => undefined,
        selectCurrentOrder: (orders) => orders[0],
        addOrderItem: async () => undefined,
        addOrderItems,
        syncErrorMessage: 'sync failed',
      }),
    );

    act(() => {
      result.current.addItems([
        {
          menuItem: createMenuItem({ id: 'fish', name: 'Fish', price: 100000, saleUnit: 'kg' }),
          quantity: 0.1,
          note: '',
        },
      ]);
    });

    expect(result.current.currentOrder?.items[0]?.quantity).toBe(0.1);
    expect(result.current.currentOrder?.items[0]?.lineTotal).toBe(10000);

    await waitFor(() => {
      expect(result.current.hasPendingOperations).toBe(false);
    });

    expect(addOrderItems).toHaveBeenCalledWith(baseOrder.id, [expect.objectContaining({ quantity: 0.1 })]);
    expect(result.current.currentOrder?.items[0]?.quantity).toBe(0.1);
    expect(result.current.currentOrder?.items[0]?.lineTotal).toBe(10000);
  });
});
