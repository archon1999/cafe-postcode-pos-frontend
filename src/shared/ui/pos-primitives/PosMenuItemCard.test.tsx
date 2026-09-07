// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PosMenuItemCard } from './PosMenuItemCard';

vi.mock('@iconify/react', () => ({
  Icon: ({ icon }: { icon: string }) => <span data-icon={icon} />,
}));

function dispatchPointer(element: Element, type: string, clientX: number, clientY: number) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX, clientY });
  Object.defineProperties(event, {
    pointerId: { value: 1 },
    pointerType: { value: 'touch' },
  });
  fireEvent(element, event);
}

const item = {
  name: 'Choyxona osh',
  prepStationName: 'Oshxona',
  price: 48000,
};

describe('PosMenuItemCard', () => {
  afterEach(() => {
    cleanup();
  });

  it('blocks touch, click and keyboard additions when ingredients run out while keeping removal available', () => {
    const onAdd = vi.fn();
    const onAddWithNote = vi.fn();
    const onRemove = vi.fn();
    render(
      <PosMenuItemCard
        item={{
          ...item,
          inventory: {
            tracked: true,
            blocked: true,
            lowStock: true,
            availableQuantity: '0',
            reason: 'shortage',
            updatedAt: null,
          },
        }}
        locale="uz"
        menuLabel="Menyu"
        selectedCount={1}
        onAdd={onAdd}
        onAddWithNote={onAddWithNote}
        onRemove={onRemove}
      />,
    );
    const card = screen.getByRole('button', { name: /Choyxona osh/ });
    expect(card.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(card);
    fireEvent.keyDown(card, { key: 'Enter' });
    dispatchPointer(card, 'pointerdown', 180, 40);
    dispatchPointer(card, 'pointermove', 90, 40);
    dispatchPointer(card, 'pointerup', 90, 40);
    expect(onAdd).not.toHaveBeenCalled();
    expect(onAddWithNote).not.toHaveBeenCalled();
    const buttons = screen.getByTestId('menu-item-controls').querySelectorAll('button');
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0]);
    expect(onRemove).toHaveBeenCalledOnce();
  });

  it('renders the selected item count as a corner badge outside the footer controls', () => {
    render(
      <PosMenuItemCard
        item={item}
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
      <PosMenuItemCard
        item={item}
        locale="uz"
        menuLabel="Menyu"
        selectedCount={0}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.queryByTestId('menu-item-count-badge')).toBeNull();
  });

  it('reveals the note action on a left swipe and opens note-first addition without a normal add click', () => {
    const onAdd = vi.fn();
    const onAddWithNote = vi.fn();
    render(
      <PosMenuItemCard
        item={item}
        locale="uz"
        menuLabel="Menyu"
        selectedCount={0}
        onAdd={onAdd}
        onAddWithNote={onAddWithNote}
        onRemove={vi.fn()}
      />,
    );

    const card = screen.getByRole('button', { name: /Choyxona osh/ });
    dispatchPointer(card, 'pointerdown', 180, 40);
    dispatchPointer(card, 'pointermove', 130, 42);

    expect(screen.getByTestId('menu-item-card-surface').getAttribute('data-swipe-revealed')).toBe('true');
    expect(
      screen.getByTestId('menu-item-note-swipe-action').querySelector('[data-icon]')?.getAttribute('data-icon'),
    ).toBe('solar:notes-bold-duotone');

    dispatchPointer(card, 'pointerup', 90, 43);
    fireEvent.click(card);

    expect(onAddWithNote).toHaveBeenCalledTimes(1);
    expect(onAdd).not.toHaveBeenCalled();
  });
});
