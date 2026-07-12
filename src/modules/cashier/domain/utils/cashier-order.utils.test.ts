import { describe, expect, it } from 'vitest';

import type { CashierOrder } from '../entities';

import {
  getCashierOrderDisplayName,
  getCashierOrderNumberLabel,
  getCurrentCashierBuilderOrder,
} from './cashier-order.utils';

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
