// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PosMenuItemGroupCard, type PosBuilderMenuItemGroup } from './PosBuilderCatalog';

afterEach(cleanup);

const group: PosBuilderMenuItemGroup = {
  id: 'burger-group',
  name: 'CHIZ BURGER',
  members: [
    {
      id: 'small',
      item: {
        id: 'burger-small',
        name: 'CHIZ BURGER (215 gr)',
        price: 40_000,
        prepStationName: 'Oshxona',
        modifierGroups: [],
      },
    },
    {
      id: 'large',
      item: {
        id: 'burger-large',
        name: 'CHIZ BURGER (238 gr)',
        price: 44_000,
        prepStationName: 'Oshxona',
        modifierGroups: [],
      },
    },
  ],
};

describe('PosMenuItemGroupCard', () => {
  it('matches a regular product card while showing the group count and minimum price', () => {
    render(<PosMenuItemGroupCard group={group} locale="uz" menuLabel="Menyu" selectedCount={0} onOpen={vi.fn()} />);

    expect(screen.getByText('Oshxona')).toBeTruthy();
    expect(screen.getByText('CHIZ BURGER')).toBeTruthy();
    expect(screen.getByText('2 ta')).toBeTruthy();
    expect(screen.queryByText(/mahsulot/i)).toBeNull();
    expect(screen.getByText('dan')).toBeTruthy();
  });
});
