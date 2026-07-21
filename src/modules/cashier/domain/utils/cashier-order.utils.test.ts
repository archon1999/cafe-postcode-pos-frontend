import { describe, expect, it } from 'vitest';

import type { CashierOrder, CashierOrderItem } from '../entities';

import {
  aggregateCashierCartItemsByStation,
  aggregateCashierOrderItems,
  getCashierOrderDisplayName,
  getCashierOrderItemsTotalQuantity,
  getCashierOrderMissingMarkingCount,
  getCashierOrderNumberLabel,
  getCurrentCashierBuilderOrder,
} from './cashier-order.utils';

describe('cashier cart aggregation', () => {
  const items: CashierOrderItem[] = [
    {
      id: 'line-1',
      catalogItem: 'item-1',
      catalogItemName: 'Cola',
      quantity: 1,
      lineTotal: 12000,
      status: 'active',
      prepStationName: 'Bar',
      markingRequiredCount: 1,
      markingScannedCount: 1,
    },
    {
      id: 'line-2',
      catalogItem: 'item-1',
      catalogItemName: 'Cola',
      quantity: '2',
      lineTotal: '24000',
      status: 'active',
      prepStationName: 'Bar',
      markingRequiredCount: 2,
      markings: [{ id: 'mark-2' }],
    },
    {
      id: 'line-3',
      catalogItem: 'item-1',
      catalogItemName: 'Cola',
      quantity: 1,
      lineTotal: 12000,
      status: 'active',
      prepStationName: 'Bar',
      note: 'Muzsiz',
    },
    {
      id: 'line-4',
      catalogItem: 'item-1',
      catalogItemName: 'Cola',
      quantity: 1,
      lineTotal: 12000,
      status: 'cancelled',
      prepStationName: 'Bar',
    },
  ];

  it('preserves station order and aggregates only exact cart-line matches', () => {
    const groups = aggregateCashierCartItemsByStation(items, 'Menyu');

    expect(groups).toHaveLength(1);
    expect(groups[0][0]).toBe('Bar');
    expect(groups[0][1]).toHaveLength(3);
    expect(groups[0][1][0]).toEqual({
      key: 'item-1::::active::Bar',
      id: 'line-2',
      catalogItem: 'item-1',
      catalogItemName: 'Cola',
      note: undefined,
      quantity: 3,
      lineTotal: 36000,
      status: 'active',
      itemIds: ['line-1', 'line-2'],
      markingRequiredCount: 3,
      markingScannedCount: 2,
      markingMissingCount: 1,
    });
    expect(groups[0][1].map((item) => [item.note, item.status])).toEqual([
      [undefined, 'active'],
      ['Muzsiz', 'active'],
      [undefined, 'cancelled'],
    ]);
  });

  it('derives scanner quantity and missing markings from the same source lines', () => {
    expect(getCashierOrderItemsTotalQuantity(items)).toBe(5);
    expect(getCashierOrderMissingMarkingCount(items)).toBe(1);
  });

  it('aggregates duplicate order rows across active statuses and keeps cancelled rows separate', () => {
    const aggregatedItems = aggregateCashierOrderItems([
      { ...items[0]!, status: 'new' },
      { ...items[1]!, status: 'cooking' },
      items[2]!,
      items[3]!,
    ]);

    expect(aggregatedItems).toHaveLength(3);
    expect(aggregatedItems[0]).toEqual(
      expect.objectContaining({
        catalogItemName: 'Cola',
        quantity: 3,
        lineTotal: 36000,
      }),
    );
    expect(aggregatedItems.map((item) => [item.note, item.status, item.quantity])).toEqual([
      [undefined, 'new', 3],
      ['Muzsiz', 'active', 1],
      [undefined, 'cancelled', 1],
    ]);
  });
});

describe('cashier order display helpers', () => {
  it('uses the custom display name when provided', () => {
    expect(getCashierOrderDisplayName({ orderNumber: 24, displayName: 'VIP mijoz' })).toBe('VIP mijoz');
  });

  it('falls back to the formatted order number when custom name is empty', () => {
    expect(getCashierOrderDisplayName({ orderNumber: 24, displayName: '   ' })).toBe('ID 24');
    expect(getCashierOrderDisplayName({ orderNumber: 24, displayName: '7' })).toBe('#7');
    expect(getCashierOrderNumberLabel({ orderNumber: 24 })).toBe('ID 24');
  });
});

describe('cashier builder order selection', () => {
  const orders: CashierOrder[] = [
    {
      id: 'hall-order',
      openedBy: 'user-1',
      orderNumber: 10,
      status: 'open',
      subtotal: 9000,
      serviceFee: 0,
      total: 9000,
      note: '',
      channel: 'hall',
      items: [],
    },
    {
      id: 'delivery-order',
      openedBy: 'user-1',
      orderNumber: 11,
      status: 'open',
      subtotal: 10000,
      serviceFee: 0,
      total: 10000,
      note: '',
      channel: 'delivery',
      items: [],
    },
    {
      id: 'takeaway-order',
      openedBy: 'user-1',
      orderNumber: 12,
      status: 'open',
      subtotal: 12000,
      serviceFee: 0,
      total: 12000,
      note: '',
      channel: 'takeaway',
      items: [],
    },
  ];

  it('selects the current user order for the active builder channel', () => {
    expect(getCurrentCashierBuilderOrder(orders, 'user-1', 'hall')?.id).toBe('hall-order');
    expect(getCurrentCashierBuilderOrder(orders, 'user-1', 'delivery')?.id).toBe('delivery-order');
    expect(getCurrentCashierBuilderOrder(orders, 'user-1', 'takeaway')?.id).toBe('takeaway-order');
  });
});
