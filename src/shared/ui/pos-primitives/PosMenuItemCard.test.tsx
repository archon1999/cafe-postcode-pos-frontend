// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PosMenuItemCard } from './PosMenuItemCard';

vi.mock('@iconify/react', () => ({
  Icon: ({ icon }: { icon: string }) => <span data-icon={icon} />,
}));

function dispatchPointer(element: Element, type: string, clientX: number, clientY: number, pointerType = 'touch') {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX, clientY });
  Object.defineProperties(event, {
    pointerId: { value: 1 },
    pointerType: { value: pointerType },
    isPrimary: { value: true },
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
    vi.useRealTimers();
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

  it('opens note-first addition when the card is dragged left with a mouse', () => {
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
    dispatchPointer(card, 'pointerdown', 180, 40, 'mouse');
    dispatchPointer(card, 'pointermove', 120, 41, 'mouse');
    expect(screen.getByTestId('menu-item-card-surface').getAttribute('data-swipe-revealed')).toBe('true');

    dispatchPointer(card, 'pointerup', 90, 42, 'mouse');
    fireEvent.click(card);

    expect(onAddWithNote).toHaveBeenCalledOnce();
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('opens quantity entry after holding a piece item for three seconds without adding one', async () => {
    vi.useFakeTimers();
    const onAdd = vi.fn();
    const onEnterQuantity = vi.fn();
    render(
      <PosMenuItemCard
        item={{ ...item, saleUnit: 'piece' }}
        locale="uz"
        menuLabel="Menyu"
        selectedCount={0}
        onAdd={onAdd}
        onEnterQuantity={onEnterQuantity}
        onRemove={vi.fn()}
      />,
    );

    const card = screen.getByRole('button', { name: /Choyxona osh/ });
    dispatchPointer(card, 'pointerdown', 100, 40);
    await act(async () => vi.advanceTimersByTime(2999));
    expect(onEnterQuantity).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTime(1));
    dispatchPointer(card, 'pointerup', 100, 40);
    fireEvent.click(card);

    expect(onEnterQuantity).toHaveBeenCalledOnce();
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('cancels quantity entry when the press ends early or the card moves', async () => {
    vi.useFakeTimers();
    const onAdd = vi.fn();
    const onEnterQuantity = vi.fn();
    render(
      <PosMenuItemCard
        item={{ ...item, saleUnit: 'piece' }}
        locale="uz"
        menuLabel="Menyu"
        selectedCount={0}
        onAdd={onAdd}
        onEnterQuantity={onEnterQuantity}
        onRemove={vi.fn()}
      />,
    );

    const card = screen.getByRole('button', { name: /Choyxona osh/ });
    dispatchPointer(card, 'pointerdown', 100, 40);
    await act(async () => vi.advanceTimersByTime(1000));
    dispatchPointer(card, 'pointerup', 100, 40);
    fireEvent.click(card);
    dispatchPointer(card, 'pointerdown', 100, 40);
    dispatchPointer(card, 'pointermove', 100, 65);
    await act(async () => vi.advanceTimersByTime(3000));
    dispatchPointer(card, 'pointercancel', 100, 65);

    expect(onAdd).toHaveBeenCalledOnce();
    expect(onEnterQuantity).not.toHaveBeenCalled();
  });
});
