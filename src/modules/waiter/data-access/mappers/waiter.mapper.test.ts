import { describe, expect, it } from 'vitest';

import { mapWaiterMenuCategory, mapWaiterOrder } from './waiter.mapper';

describe('mapWaiterOrder', () => {
  it('maps the backend service item type', () => {
    const category = mapWaiterMenuCategory({
      id: 'category-1',
      name: 'Xizmatlar',
      items: [{ id: 'service-1', name: 'Yetkazish', kind: 'item', price: 0, item_type: 'service' }],
    });

    expect(category.items[0].itemType).toBe('service');
  });

  it('preserves missing service fee components for legacy percentage fallback', () => {
    const order = mapWaiterOrder({
      id: 'legacy-fee-order',
      tableSession: 'session-1',
      orderNumber: 23,
      status: 'open',
      subtotal: 20000,
      serviceFee: 2000,
      serviceFeeEnabled: true,
      serviceFeePercent: 10,
      total: 22000,
      note: '',
      channel: 'hall',
      items: [],
    });

    expect(order.serviceFeePercent).toBe(10);
    expect(order.serviceFeeComponents).toBeUndefined();
  });
});
