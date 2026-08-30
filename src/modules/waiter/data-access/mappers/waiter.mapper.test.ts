import { describe, expect, it } from 'vitest';

import { mapHall, mapWaiterMenuCategory, mapWaiterOrder } from './waiter.mapper';

describe('mapWaiterOrder', () => {
  it('maps the backend service item type', () => {
    const category = mapWaiterMenuCategory({
      id: 'category-1',
      name: 'Xizmatlar',
      items: [{ id: 'service-1', name: 'Yetkazish', kind: 'item', price: 0, item_type: 'service' }],
    });

    expect(category.items[0].itemType).toBe('service');
  });

  it('maps the same item groups used by the cashier builder', () => {
    const category = mapWaiterMenuCategory({
      id: 'category-1',
      name: 'Burgerlar',
      items: [],
      item_groups: [
        {
          id: 'burger-group',
          name: 'Chizburger',
          sort_order: 2,
          members: [
            {
              id: 'large',
              variant_name: 'Katta',
              sort_order: 1,
              item: {
                id: 'burger-large',
                name: 'Katta chizburger',
                kind: 'item',
                price: 44_000,
                sale_unit: 'piece',
              },
            },
          ],
        },
      ],
    });

    expect(category.itemGroups?.[0]).toMatchObject({
      id: 'burger-group',
      sortOrder: 2,
      members: [
        {
          variantName: 'Katta',
          sortOrder: 1,
          item: { id: 'burger-large', saleUnit: 'piece' },
        },
      ],
    });
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

describe('mapHall', () => {
  it('maps grouped physical table metadata on active sessions', () => {
    const hall = mapHall({
      id: 'hall-1',
      name: 'Main',
      tables: [
        {
          id: 'table-1',
          name: 'Main 1',
          tableNumber: 1,
          seatCount: 4,
          status: 'occupied',
          active_session: {
            id: 'session-1',
            guestCount: 4,
            status: 'open',
            primary_table_id: 'table-1',
            table_ids: ['table-1', 'table-2'],
            table_numbers: [1, 2],
          },
        },
      ],
    });

    expect(hall.tables[0].activeSession).toMatchObject({
      primaryTableId: 'table-1',
      tableIds: ['table-1', 'table-2'],
      tableNumbers: [1, 2],
    });
  });
});
