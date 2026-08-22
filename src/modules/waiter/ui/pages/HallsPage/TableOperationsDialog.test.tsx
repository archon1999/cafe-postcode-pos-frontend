// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ActiveSession, Hall } from 'modules/waiter/domain';
import { getPosCopy } from 'shared/locale/copy';

import { TableOperationsDialog } from './TableOperationsDialog';

const copy = getPosCopy('uz');
const sourceSession: ActiveSession = {
  id: 'session-1',
  guestCount: 2,
  status: 'open',
  primaryTableId: 'table-1',
  tableIds: ['table-1'],
  tableNumbers: [1],
};
const halls: Hall[] = [
  {
    id: 'hall-1',
    name: 'Main',
    tables: [
      { id: 'table-1', name: 'Main 1', tableNumber: 1, seatCount: 4, status: 'occupied' },
      {
        id: 'table-2',
        name: 'Main 2',
        tableNumber: 2,
        seatCount: 4,
        status: 'occupied',
        activeSessions: [{ id: 'session-2', guestCount: 2, status: 'open' }],
      },
      { id: 'table-3', name: 'Main 3', tableNumber: 3, seatCount: 4, status: 'available' },
    ],
  },
];

afterEach(cleanup);

describe('TableOperationsDialog', () => {
  it('warns and submits the selected occupied transfer target', () => {
    const onConfirm = vi.fn();
    render(
      <TableOperationsDialog
        open
        mode="transfer"
        sourceTable={halls[0].tables[0]}
        sourceSession={sourceSession}
        halls={halls}
        copy={copy}
        pending={false}
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /2\. Main 2/ }));
    expect(screen.getByText(copy.targetTableOccupied)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: copy.confirmMoveTable }));

    expect(onConfirm).toHaveBeenCalledWith({
      mode: 'transfer',
      targetTable: halls[0].tables[1],
      targetSessionId: 'session-2',
    });
  });

  it('submits several selected physical tables for grouping', () => {
    const onConfirm = vi.fn();
    render(
      <TableOperationsDialog
        open
        mode="group"
        sourceTable={halls[0].tables[0]}
        sourceSession={sourceSession}
        halls={halls}
        copy={copy}
        pending={false}
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /2\. Main 2/ }));
    fireEvent.click(screen.getByRole('button', { name: /3\. Main 3/ }));
    fireEvent.click(screen.getByRole('button', { name: copy.confirmGroupTables }));

    expect(onConfirm).toHaveBeenCalledWith({ mode: 'group', tableIds: ['table-2', 'table-3'] });
  });
});
