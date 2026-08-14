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

  it('maps backend table and zone context', () => {
    const order = mapCashierOrder({
      id: 'order-zone',
      order_number: 21,
      status: 'open',
      subtotal: 10000,
      serviceFee: 0,
      total: 10000,
      note: '',
      channel: 'hall',
      table_number: 23,
      zone_name: 'VIP kabina',
      show_zone_name: true,
      items: [],
    });

    expect(order).toMatchObject({ tableNumber: 23, zoneName: 'VIP kabina', showZoneName: true });
  });

  it('maps weighted quantities and cashier total override fields', () => {
    const order = mapCashierOrder({
      id: 'order-2',
      order_number: 20,
      status: 'open',
      subtotal: 140000,
      serviceFee: 0,
      total: 50000,
      calculated_total: 140000,
      total_override: 50000,
      total_override_reason: 'Kelishilgan narx',
      total_overridden_at: '2026-08-12T12:00:00Z',
      payment_total_editable: true,
      note: '',
      channel: 'takeaway',
      items: [
        {
          id: 'item-1',
          catalogItem: 'fish-1',
          catalogItemName: 'Baliq',
          quantity: 1.4,
          sale_unit: 'kg',
          lineTotal: 140000,
          status: 'new',
        },
      ],
    });

    expect(order.items[0]).toMatchObject({ quantity: 1.4, saleUnit: 'kg' });
    expect(order).toMatchObject({
      calculatedTotal: 140000,
      totalOverride: 50000,
      totalOverrideReason: 'Kelishilgan narx',
      paymentTotalEditable: true,
    });
  });
});
