import { describe, expect, it } from 'vitest';

import {
  deriveOptimisticBuilderOrder,
  type BuilderMenuItemLike,
  type BuilderOrderItemLike,
  type BuilderOrderLike,
  type PendingAddOperation,
  type PendingRemoveOperation,
} from './optimistic-builder-order';

type TestMenuItem = BuilderMenuItemLike;
type TestOrderItem = BuilderOrderItemLike;
type TestOrder = BuilderOrderLike<TestOrderItem> & {
  tableSession?: string | null;
};

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
    orderNumber: 101,
    status: 'open',
    subtotal: 12000,
    serviceFee: 1200,
    serviceFeePercent: 10,
    total: 13200,
    note: '',
    channel: 'hall',
    items: [createOrderItem()],
    tableSession: 'session-1',
    ...overrides,
  };
}

function createPendingAdd(
  overrides: Partial<PendingAddOperation<TestMenuItem>> = {},
): PendingAddOperation<TestMenuItem> {
  return {
    opId: 'op-1',
    tempItemId: 'temp-builder-item-1',
    menuItem: createMenuItem(),
    note: '',
    canceled: false,
    ...overrides,
  };
}

describe('optimistic builder order', () => {
  it('adds pending menu items on top of an existing order immediately', () => {
    const order = deriveOptimisticBuilderOrder<TestMenuItem, TestOrderItem, TestOrder>({
      baseOrder: createOrder(),
      channel: 'hall',
      defaultServiceFeePercent: 10,
      pendingAdds: [createPendingAdd({ menuItem: createMenuItem({ id: 'menu-2', name: 'Cake', price: 18000 }) })],
      pendingRemoves: [],
      tempOrderId: null,
    });

    expect(order?.items).toHaveLength(2);
    expect(order?.subtotal).toBe(30000);
    expect(order?.serviceFee).toBe(3000);
    expect(order?.total).toBe(33000);
  });

  it('creates a temporary draft order when the first optimistic add starts', () => {
    const order = deriveOptimisticBuilderOrder<TestMenuItem, TestOrderItem, TestOrder>({
      baseOrder: undefined,
      channel: 'takeaway',
      defaultServiceFeePercent: 0,
      pendingAdds: [createPendingAdd()],
      pendingRemoves: [],
      tempOrderId: 'temp-order-1',
    });

    expect(order).toBeDefined();
    expect(order?.id).toBe('temp-order-1');
    expect(order?.channel).toBe('takeaway');
    expect(order?.items).toHaveLength(1);
    expect(order?.subtotal).toBe(12000);
    expect(order?.serviceFee).toBe(0);
    expect(order?.total).toBe(12000);
  });

  it('keeps totals correct with mixed pending adds and removes', () => {
    const pendingRemoves: PendingRemoveOperation[] = [{ opId: 'remove-1', itemId: 'item-1' }];
    const order = deriveOptimisticBuilderOrder<TestMenuItem, TestOrderItem, TestOrder>({
      baseOrder: createOrder({
        items: [
          createOrderItem(),
          createOrderItem({
            id: 'item-2',
            catalogItem: 'menu-2',
            catalogItemName: 'Cake',
            lineTotal: 18000,
            prepStationName: 'Kitchen',
          }),
        ],
        subtotal: 30000,
        serviceFee: 3000,
        total: 33000,
      }),
      channel: 'hall',
      defaultServiceFeePercent: 10,
      pendingAdds: [
        createPendingAdd({
          menuItem: createMenuItem({ id: 'menu-3', name: 'Tea', price: 6000 }),
          tempItemId: 'temp-builder-item-2',
        }),
      ],
      pendingRemoves,
      tempOrderId: null,
    });

    expect(order?.items.map((item) => item.catalogItem)).toEqual(['menu-2', 'menu-3']);
    expect(order?.subtotal).toBe(24000);
    expect(order?.serviceFee).toBe(2400);
    expect(order?.total).toBe(26400);
  });

  it('recomputes service fee from the active mode default when no server order exists', () => {
    const hallOrder = deriveOptimisticBuilderOrder<TestMenuItem, TestOrderItem, TestOrder>({
      baseOrder: undefined,
      channel: 'hall',
      defaultServiceFeePercent: 10,
      pendingAdds: [createPendingAdd({ menuItem: createMenuItem({ price: 10000 }) })],
      pendingRemoves: [],
      tempOrderId: 'temp-order-2',
    });
    const takeawayOrder = deriveOptimisticBuilderOrder<TestMenuItem, TestOrderItem, TestOrder>({
      baseOrder: undefined,
      channel: 'takeaway',
      defaultServiceFeePercent: 0,
      pendingAdds: [createPendingAdd({ menuItem: createMenuItem({ price: 10000 }) })],
      pendingRemoves: [],
      tempOrderId: 'temp-order-3',
    });

    expect(hallOrder?.serviceFeePercent).toBe(10);
    expect(hallOrder?.total).toBe(11000);
    expect(takeawayOrder?.serviceFeePercent).toBe(0);
    expect(takeawayOrder?.total).toBe(10000);
  });
});
