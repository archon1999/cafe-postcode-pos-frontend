// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { DiningTable } from 'modules/waiter/domain';
import { getPosCopy } from 'shared/locale/copy';

import { OpenTableDialog } from './OpenTableDialog';

afterEach(cleanup);

describe('OpenTableDialog', () => {
  it('shows only the primary open action even if stale session summaries are present', () => {
    const copy = getPosCopy('uz');
    const table: DiningTable = {
      id: 'table-1',
      name: 'A1',
      tableNumber: 1,
      seatCount: 4,
      status: 'available',
      activeSessions: [{ id: 'stale-session', guestCount: 1, status: 'closed' }],
    };

    render(
      <OpenTableDialog
        table={table}
        guestCount={1}
        guestLimit={4}
        canManageTables
        canReserveTables={false}
        opening={false}
        reserving={false}
        copy={copy}
        onGuestCountChange={vi.fn()}
        onClose={vi.fn()}
        onOpen={vi.fn()}
        onReserve={vi.fn()}
      />,
    );

    expect(screen.getAllByRole('button', { name: copy.openTable })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: `${copy.openTable} #1` })).toBeNull();
  });
});
