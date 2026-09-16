// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { CashierOrder } from 'modules/cashier/domain/entities/order.types';
import { getPosCopy } from 'shared/locale/copy';

import { OpenChecksList } from './OpenChecksList';

vi.mock('@iconify/react', () => ({
  Icon: ({ icon }: { icon: string }) => <span data-icon={icon} />,
}));

function dispatchPointer(element: Element, type: string, clientX: number, clientY: number) {
  const event = new MouseEvent(type, {
    bubbles: true,
    button: 0,
    cancelable: true,
    clientX,
    clientY,
  });
  Object.defineProperties(event, {
    pointerId: { value: 1 },
    pointerType: { value: 'mouse' },
    isPrimary: { value: true },
  });
  fireEvent(element, event);
}

const order: CashierOrder = {
  id: 'order-1',
  orderNumber: 101,
  status: 'open',
  subtotal: 48000,
  serviceFee: 0,
  total: 48000,
  note: '',
  channel: 'hall',
  items: [],
  tableName: 'Stol 4',
  tableNumber: '4',
  guestCount: 2,
  openedByName: 'Ali',
};

describe('OpenChecksList', () => {
  afterEach(cleanup);

  it('opens the edit flow when an open check is dragged left with a mouse without selecting it', () => {
    const onSelect = vi.fn();
    const onSwipeEdit = vi.fn();
    render(
      <OpenChecksList
        copy={getPosCopy('uz')}
        locale="uz"
        orders={[order]}
        selectedTab="open"
        onRename={vi.fn()}
        onSelect={onSelect}
        onSwipeEdit={onSwipeEdit}
      />,
    );

    const card = screen.getByRole('button', { name: /ID 101/ });
    dispatchPointer(card, 'pointerdown', 180, 40);
    dispatchPointer(card, 'pointermove', 125, 41);
    expect(card.getAttribute('data-swipe-revealed')).toBe('true');

    dispatchPointer(card, 'pointerup', 90, 42);
    fireEvent.click(card);

    expect(onSwipeEdit).toHaveBeenCalledWith(order);
    expect(onSelect).not.toHaveBeenCalled();
  });
});
