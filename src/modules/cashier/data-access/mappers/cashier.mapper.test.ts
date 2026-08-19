import { describe, expect, it } from 'vitest';

import { mapCashierMenuCategory, mapCashierOrder } from './cashier.mapper';

describe('mapCashierOrder', () => {
  it('maps the backend service item type', () => {
    const category = mapCashierMenuCategory({
      id: 'category-1',
      name: 'Xizmatlar',
      items: [{ id: 'service-1', name: 'Yetkazish', kind: 'item', price: 0, item_type: 'service' }],
    });

    expect(category.items[0].itemType).toBe('service');
  });

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

  it('preserves missing service fee components for legacy percentage fallback', () => {
    const order = mapCashierOrder({
      id: 'legacy-fee-order',
      order_number: 22,
      status: 'open',
      subtotal: 10000,
      serviceFee: 1000,
      serviceFeeEnabled: true,
      serviceFeePercent: 10,
      total: 11000,
      note: '',
      channel: 'hall',
      items: [],
    });

    expect(order.serviceFeePercent).toBe(10);
    expect(order.serviceFeeComponents).toBeUndefined();
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
