// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { PosBuilderMenuItemGroup } from './PosBuilderCatalog';
import { PosItemGroupConfiguratorDialog } from './PosItemGroupConfiguratorDialog';

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

const group: PosBuilderMenuItemGroup = {
  id: 'pizza',
  name: 'Pepperoni',
  members: ['S', 'M'].map((size) => ({
    id: `member-${size}`,
    item: {
      id: `pizza-${size}`,
      name: `Pepperoni ${size}`,
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

const weightedGroup: PosBuilderMenuItemGroup = {
  id: 'weighted-products',
  name: 'Tortib sotiladigan mahsulotlar',
  members: [
    {
      id: 'member-fish',
      item: {
        id: 'fish',
        name: 'Baliq',
        price: 100_000,
        saleUnit: 'kg',
      },
    },
  ],
};

describe('PosItemGroupConfiguratorDialog', () => {
  it('collects quantities for several sizes and exact modifier configurations', async () => {
    const onConfirm = vi.fn();
    render(
      <PosItemGroupConfiguratorDialog group={group} locale="uz" copy={copy} onClose={vi.fn()} onConfirm={onConfirm} />,
    );

    const addButtons = screen.getAllByLabelText('Miqdorni ko‘paytirish');
    fireEvent.click(addButtons[0]);
    fireEvent.click(addButtons[0]);
    fireEvent.click(addButtons[2]);

    fireEvent.click(screen.getAllByRole('button', { name: 'Izoh qo‘shish' })[0]);
    fireEvent.change(screen.getByLabelText('Mahsulot uchun izoh'), { target: { value: 'Ko‘proq pishloq' } });
    fireEvent.click(screen.getByRole('button', { name: 'Izohni saqlash' }));

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Izoh qo‘shish' })).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: /3 ta qo‘shish/i }));

    expect(onConfirm).toHaveBeenCalledWith([
      expect.objectContaining({
        item: expect.objectContaining({ id: 'pizza-S' }),
        note: 'Ko‘proq pishloq',
        quantity: 2,
      }),
      expect.objectContaining({ item: expect.objectContaining({ id: 'pizza-M' }), note: '', quantity: 1 }),
    ]);
  });

  it('preserves intermediate decimal text and confirms a fractional kilogram quantity', () => {
    const onConfirm = vi.fn();
    render(
      <PosItemGroupConfiguratorDialog
        group={weightedGroup}
        locale="uz"
        copy={copy}
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    const input = screen.getByRole('textbox', { name: /oddiy kg/i }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '1.' } });
    expect(input.value).toBe('1.');

    fireEvent.change(input, { target: { value: '0' } });
    expect(input.value).toBe('0');
    fireEvent.change(input, { target: { value: '0.' } });
    expect(input.value).toBe('0.');
    fireEvent.change(input, { target: { value: '0.125' } });
    expect(input.value).toBe('0.125');

    fireEvent.click(screen.getByRole('button', { name: /1 tur qo‘shish/i }));
    expect(onConfirm).toHaveBeenCalledWith([
      expect.objectContaining({ item: expect.objectContaining({ id: 'fish' }), note: '', quantity: 0.125 }),
    ]);
  });
});
