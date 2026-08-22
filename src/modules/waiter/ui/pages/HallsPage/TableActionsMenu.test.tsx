// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { DiningTable } from 'modules/waiter/domain';
import { getPosCopy } from 'shared/locale/copy';

import { TableActionsMenu } from './TableActionsMenu';

const copy = getPosCopy('uz');

function renderMenu(table: DiningTable, onAction = vi.fn()) {
  const anchor = document.createElement('button');
  document.body.appendChild(anchor);
  render(<TableActionsMenu anchorEl={anchor} table={table} copy={copy} onClose={vi.fn()} onAction={onAction} />);
  return onAction;
}

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

describe('TableActionsMenu', () => {
  it('shows transfer and group actions for a primary occupied table', () => {
    const table: DiningTable = {
      id: 'table-1',
      name: 'A1',
      tableNumber: 1,
      seatCount: 4,
      status: 'occupied',
      activeSessions: [
        {
          id: 'session-1',
          guestCount: 4,
          status: 'open',
          primaryTableId: 'table-1',
          tableIds: ['table-1'],
        },
      ],
    };
    const onAction = renderMenu(table);

    expect(screen.getByRole('menuitem', { name: copy.moveTable })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: copy.groupTables })).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: copy.ungroupTables })).toBeNull();

    fireEvent.click(screen.getByRole('menuitem', { name: copy.moveTable }));
    expect(onAction).toHaveBeenCalledWith('transfer', table.activeSessions?.[0]);
  });

  it('only offers ungrouping from a grouped secondary table', () => {
    const table: DiningTable = {
      id: 'table-2',
      name: 'A2',
      tableNumber: 2,
      seatCount: 4,
      status: 'occupied',
      activeSessions: [
        {
          id: 'session-1',
          guestCount: 4,
          status: 'open',
          primaryTableId: 'table-1',
          tableIds: ['table-1', 'table-2'],
        },
      ],
    };

    renderMenu(table);

    expect(screen.queryByRole('menuitem', { name: copy.moveTable })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: copy.groupTables })).toBeNull();
    expect(screen.getByRole('menuitem', { name: copy.ungroupTables })).toBeTruthy();
  });
});
