// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { CashierMenuItemGroup } from 'modules/cashier/domain';

import { CashierItemGroupConfiguratorDialog } from './CashierItemGroupConfiguratorDialog';

afterEach(cleanup);

const copy = {
  addToOrder: 'Qo‘shish',
  free: 'Bepul',
  optional: 'Ixtiyoriy',
  required: 'Majburiy',
  selectOne: 'Bittasini tanlang',
  selectUpTo: '{{count}} tagacha',
  selectedCount: '{{count}} ta',
};

const group: CashierMenuItemGroup = {
  id: 'pizza',
  name: 'Pepperoni',
  sortOrder: 0,
  members: ['S', 'M'].map((size, memberIndex) => ({
    id: `member-${size}`,
    variantName: size,
    sortOrder: memberIndex,
    item: {
      id: `pizza-${size}`,
      name: `Pepperoni ${size}`,
      kind: 'food',
      price: size === 'S' ? 40_000 : 55_000,
      modifierGroups: [
        {
          id: `filling-${size}`,
          name: 'Masalliq',
          selectionType: 'single' as const,
          minSelections: 1,
          maxSelections: 1,
          options: [
            { id: `cheese-${size}`, name: 'Pishloqli', priceDelta: 5_000 },
            { id: `sausage-${size}`, name: 'Kolbasali', priceDelta: 7_000 },
          ],
        },
      ],
    },
  })),
};

describe('CashierItemGroupConfiguratorDialog', () => {
  it('collects quantities for several sizes and exact modifier configurations', () => {
    const onConfirm = vi.fn();
    render(
      <CashierItemGroupConfiguratorDialog
        group={group}
        locale="uz"
        copy={copy}
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    const addButtons = screen.getAllByLabelText('Miqdorni ko‘paytirish');
    fireEvent.click(addButtons[0]);
    fireEvent.click(addButtons[0]);
    fireEvent.click(addButtons[2]);

    fireEvent.click(screen.getByRole('button', { name: /3 ta qo‘shish/i }));

    expect(onConfirm).toHaveBeenCalledWith([
      expect.objectContaining({ item: expect.objectContaining({ id: 'pizza-S' }), quantity: 2 }),
      expect.objectContaining({ item: expect.objectContaining({ id: 'pizza-M' }), quantity: 1 }),
    ]);
  });
});
