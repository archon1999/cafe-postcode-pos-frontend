// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { CashierMenuItem } from 'modules/cashier/domain';
import { getPosCopy } from 'shared/locale/copy';

import { CashierBuilderDesktopCart } from './CashierBuilderCart';

vi.mock('@iconify/react', () => ({
  Icon: ({ icon }: { icon: string }) => <span data-icon={icon} />,
}));

describe('CashierBuilderDesktopCart', () => {
  it('forwards the selected item to the item-note editor', () => {
    const onEditItemNote = vi.fn();
    const menuItem = { id: 'product-1', name: 'Burger' } as CashierMenuItem;
    const cartItem = {
      key: 'product-1',
      id: 'item-1',
      catalogItem: 'product-1',
      catalogItemName: 'Burger',
      note: '',
      quantity: 1,
      lineTotal: 10_000,
      status: 'new',
      itemIds: ['item-1'],
    };

    render(
      <CashierBuilderDesktopCart
        channel="takeaway"
        channelSwitchDisabled={false}
        copy={getPosCopy('uz')}
        currentOrderLabel="#4"
        groups={[['Oshxona', [cartItem]]]}
        isSubmitDisabled={false}
        isSubmitting={false}
        kitchenNote=""
        locale="uz"
        menuItems={new Map([[menuItem.id, menuItem]])}
        missingMarkingMessage=""
        selectedItemKey={cartItem.key}
        serviceFee={0}
        serviceFeeLabel="Xizmat haqi"
        showMissingMarkings={false}
        showServiceFee={false}
        showVat={false}
        subtotal={10_000}
        total={10_000}
        userName="Cashier"
        vatAmount={0}
        vatLabel="QQS"
        onAdd={vi.fn()}
        onEditItemNote={onEditItemNote}
        onChannelChange={vi.fn()}
        onCheckout={vi.fn()}
        onKitchenNoteChange={vi.fn()}
        onRemove={vi.fn()}
        onSelect={vi.fn()}
        onSendOrder={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Izoh qo‘shish' }));

    expect(onEditItemNote).toHaveBeenCalledWith(cartItem);
    expect(document.querySelector('[data-order-avatar="#4"]')).toBeTruthy();
    expect(document.querySelector('[data-operator-emphasis="true"]')?.textContent).toBe('Cashier');
    expect(screen.queryByText('TG')).toBeNull();
  });
});
