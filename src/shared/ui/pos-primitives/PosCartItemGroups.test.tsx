// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PosCartItemGroups, type PosCartItem, type PosCartItemGroupsProps } from './PosCartItemGroups';

vi.mock('@iconify/react', () => ({
  Icon: ({ icon }: { icon: string }) => <span data-icon={icon} />,
}));

afterEach(cleanup);

const item: PosCartItem = {
  key: 'lavash::Piyozsiz',
  id: 'item-2',
  catalogItem: 'lavash',
  catalogItemName: 'Lavash',
  note: 'Piyozsiz',
  modifiers: [{ groupName: 'Xamir', optionName: 'Pishloqli bort', priceDelta: 0 }],
  quantity: 1,
  lineTotal: 30_000,
  status: 'new',
  itemIds: ['item-2'],
};

function renderGroups(overrides?: Partial<PosCartItemGroupsProps<{ id: string }>>) {
  const props = {
    groups: [['Oshxona', [item]]] as PosCartItemGroupsProps<{ id: string }>['groups'],
    itemNoteAddLabel: 'Izoh qo‘shish',
    itemNoteEditLabel: 'Izohni tahrirlash',
    itemNotePendingLabel: 'Mahsulot saqlanmoqda',
    locale: 'uz' as const,
    menuItems: new Map([['lavash', { id: 'lavash' }]]),
    onAdd: vi.fn(),
    onEditNote: vi.fn(),
    onRemove: vi.fn(),
    onSelect: vi.fn(),
    selectedItemKey: item.key,
    variant: 'desktop' as const,
    ...overrides,
  };
  render(<PosCartItemGroups {...props} />);
  return props;
}

describe('PosCartItemGroups item notes', () => {
  it('shows the note and opens item-note editing for the selected cart row', () => {
    const props = renderGroups();

    expect(screen.getByText('Piyozsiz')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Izohni tahrirlash' }));

    expect(props.onEditNote).toHaveBeenCalledWith(item);
  });

  it('shows the item note after its modifiers', () => {
    renderGroups();

    const modifier = screen.getByText('Xamir: Pishloqli bort');
    const note = screen.getByText('Piyozsiz');
    expect(modifier.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('disables note editing while an optimistic item is still syncing', () => {
    renderGroups({
      groups: [['Oshxona', [{ ...item, id: 'temp-builder-123', itemIds: ['temp-builder-123'], note: '' }]]],
    });

    expect(screen.getByRole('button', { name: 'Mahsulot saqlanmoqda' })).toHaveProperty('disabled', true);
  });
});
