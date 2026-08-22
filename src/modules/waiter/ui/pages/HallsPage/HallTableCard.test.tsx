// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { DiningTable } from 'modules/waiter/domain';
import { getPosCopy } from 'shared/locale/copy';

import { HallTableCard } from './HallTableCard';

afterEach(cleanup);

describe('HallTableCard', () => {
  it('keeps primary selection separate from table actions', () => {
    const table: DiningTable = {
      id: 'table-1',
      name: 'A1',
      tableNumber: 1,
      seatCount: 4,
      status: 'occupied',
      activeSession: { id: 'session-1', guestCount: 4, status: 'open' },
      activeSessions: [{ id: 'session-1', guestCount: 4, status: 'open' }],
    };
    const onSelect = vi.fn();
    const onOpenActions = vi.fn();
    render(<HallTableCard copy={getPosCopy('uz')} table={table} onSelect={onSelect} onOpenActions={onOpenActions} />);

    const primaryButton = screen.getByRole('button', { name: 'A1' });
    fireEvent.click(primaryButton);
    expect(onSelect).toHaveBeenCalledWith(table);

    fireEvent.click(screen.getByRole('button', { name: /Stol amallari/ }));
    expect(onOpenActions).toHaveBeenCalledWith(table, expect.any(HTMLElement));
    expect(onSelect).toHaveBeenCalledTimes(1);

    fireEvent.contextMenu(primaryButton);
    expect(onOpenActions).toHaveBeenCalledTimes(2);
  });
});
