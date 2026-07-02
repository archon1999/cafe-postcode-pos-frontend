import { describe, expect, it } from 'vitest';

import { mapCashierOrder } from './cashier.mapper';

describe('mapCashierOrder', () => {
  it('maps backend snake_case order number for receipt context', () => {
    const order = mapCashierOrder({
      id: 'order-1',
      order_number: 19,
      status: 'closed',
      subtotal: 28000,
      serviceFee: 0,
      total: 28000,
      note: '',
      channel: 'takeaway',
      items: [],
    });

    expect(order.orderNumber).toBe(19);
  });
});
