// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { CashierMenuItemGroup } from 'modules/cashier/domain';

import { CashierMenuItemGroupCard } from './CashierMenuItemGroupCard';

afterEach(cleanup);

const group: CashierMenuItemGroup = {
  id: 'burger-group',
  name: 'CHIZ BURGER',
  sortOrder: 0,
  members: [
    {
      id: 'small',
      variantName: 'S',
      sortOrder: 0,
      item: {
        id: 'burger-small',
        name: 'CHIZ BURGER (215 gr)',
        kind: 'food',
        price: 40_000,
        prepStationName: 'Oshxona',
        modifierGroups: [],
      },
    },
    {
      id: 'large',
      variantName: 'L',
      sortOrder: 1,
      item: {
        id: 'burger-large',
        name: 'CHIZ BURGER (238 gr)',
        kind: 'food',
        price: 44_000,
        prepStationName: 'Oshxona',
        modifierGroups: [],
      },
    },
  ],
};

describe('CashierMenuItemGroupCard', () => {
  it('matches a regular product card while showing the group count and minimum price', () => {
    render(<CashierMenuItemGroupCard group={group} locale="uz" menuLabel="Menyu" selectedCount={0} onOpen={vi.fn()} />);

    expect(screen.getByText('Oshxona')).toBeTruthy();
    expect(screen.getByText('CHIZ BURGER')).toBeTruthy();
    expect(screen.getByText('2 ta')).toBeTruthy();
    expect(screen.queryByText(/mahsulot/i)).toBeNull();
    expect(screen.getByText('dan')).toBeTruthy();
  });
});
