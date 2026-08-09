// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PosProductConfiguratorDialog } from './PosProductConfiguratorDialog';

const item = {
  id: 'pizza-1',
  name: 'Donar pizza',
  price: 104000,
  modifierGroups: [
    {
      id: 'dough',
      name: 'Xamir turi',
      selectionType: 'single' as const,
      minSelections: 1,
      maxSelections: 1,
      options: [
        { id: 'cheese-crust', name: 'Pishloqli bort', priceDelta: 27000 },
        { id: 'thin', name: 'Yupqa', priceDelta: 0 },
      ],
    },
  ],
};

const copy = {
  addToOrder: "Buyurtmaga qo'shish",
  free: 'Bepul',
  optional: 'Ixtiyoriy',
  required: 'Majburiy',
  selectOne: 'Bittasini tanlang',
  selectUpTo: '{{count}} tagacha tanlang',
  selectedCount: '{{count}} ta',
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
});

describe('PosProductConfiguratorDialog', () => {
  it('enforces required choices and confirms the paid option with backend identifiers', () => {
    const onConfirm = vi.fn();
    render(
      <PosProductConfiguratorDialog item={item} locale="uz" copy={copy} onClose={vi.fn()} onConfirm={onConfirm} />,
    );

    const addButton = screen.getByRole('button', { name: /Buyurtmaga qo'shish/ });
    expect((addButton as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole('radio', { name: /Pishloqli bort/ }));

    expect((addButton as HTMLButtonElement).disabled).toBe(false);
    expect(addButton.textContent?.replace(/\s/g, ' ')).toContain('131 000');
    fireEvent.click(addButton);
    expect(onConfirm).toHaveBeenCalledWith(item, [{ group: 'dough', options: ['cheese-crust'] }]);
  });

  it('shows zero-price options as free and keeps the base price', () => {
    render(<PosProductConfiguratorDialog item={item} locale="uz" copy={copy} onClose={vi.fn()} onConfirm={vi.fn()} />);
    fireEvent.click(screen.getByRole('radio', { name: /Yupqa/ }));
    expect(screen.getAllByText('Bepul').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /Buyurtmaga qo'shish/ }).textContent?.replace(/\s/g, ' ')).toContain(
      '104 000',
    );
  });
});
