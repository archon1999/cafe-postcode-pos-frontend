// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CashierMenuItemCard } from './CashierMenuItemCard';

vi.mock('@iconify/react', () => ({
  Icon: ({ icon }: { icon: string }) => <span data-icon={icon} />,
}));

describe('CashierMenuItemCard', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the selected item count as a corner badge outside the footer controls', () => {
    render(
      <CashierMenuItemCard
        item={{
          id: 'item-1',
          name: 'Choyxona osh',
          kind: 'product',
          prepStationName: 'Oshxona',
          price: 48000,
        }}
        locale="uz"
        menuLabel="Menyu"
        selectedCount={4}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    const badge = screen.getByTestId('menu-item-count-badge');
    const controls = screen.getByTestId('menu-item-controls');
    const surface = screen.getByTestId('menu-item-card-surface');

    expect(badge.textContent).toBe('4');
    expect(surface.contains(badge)).toBe(false);
    expect(controls.contains(badge)).toBe(false);
    expect(controls.querySelectorAll('button')).toHaveLength(2);
  });

  it('does not render a count badge when the item is not selected', () => {
    render(
      <CashierMenuItemCard
        item={{
          id: 'item-1',
          name: 'Choyxona osh',
          kind: 'product',
          prepStationName: 'Oshxona',
          price: 48000,
        }}
        locale="uz"
        menuLabel="Menyu"
        selectedCount={0}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.queryByTestId('menu-item-count-badge')).toBeNull();
  });
});
