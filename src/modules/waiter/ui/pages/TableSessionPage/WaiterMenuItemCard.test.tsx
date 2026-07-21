// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { getPosCopy } from 'shared/locale/copy';

import { WaiterMenuItemCard } from './WaiterMenuItemCard';

vi.mock('@iconify/react', () => ({
  Icon: ({ icon }: { icon: string }) => <span data-icon={icon} />,
}));

describe('WaiterMenuItemCard', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the selected item count as a corner badge outside the footer controls', () => {
    render(
      <WaiterMenuItemCard
        copy={getPosCopy('uz')}
        locale="uz"
        menuItem={{
          id: 'item-1',
          name: 'Choyxona osh',
          kind: 'product',
          prepStationName: 'Oshxona',
          price: 48000,
        }}
        selectedCount={4}
        latestItemId="order-item-4"
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
      <WaiterMenuItemCard
        copy={getPosCopy('uz')}
        locale="uz"
        menuItem={{
          id: 'item-1',
          name: 'Choyxona osh',
          kind: 'product',
          prepStationName: 'Oshxona',
          price: 48000,
        }}
        selectedCount={0}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.queryByTestId('menu-item-count-badge')).toBeNull();
  });
});
