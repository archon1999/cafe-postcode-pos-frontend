// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { type ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PosShell } from './PosShell';

const usePosSessionMock = vi.fn();

vi.mock('modules/auth/ui/session-context', () => ({
  usePosSession: () => usePosSessionMock(),
}));

vi.mock('modules/cashier', () => ({
  useCashierOpenChecksCountQuery: () => ({ data: 0 }),
}));

vi.mock('modules/kitchen', () => ({
  useKitchenActiveTicketCountQuery: () => ({ data: 0 }),
}));

function renderShell(children: ReactNode = <div>content</div>) {
  return render(
    <MemoryRouter initialEntries={['/waiter/halls']}>
      <PosShell>{children}</PosShell>
    </MemoryRouter>,
  );
}

function mockSession(permissionCodes: string[]) {
  usePosSessionMock.mockReturnValue({
    session: {
      user: {
        id: 'user-1',
        username: 'user',
        fullName: 'User',
        restaurantAccessActive: true,
        permissionCodes,
      },
    },
    locale: 'uz',
  });
}

describe('PosShell', () => {
  beforeEach(() => {
    cleanup();
    usePosSessionMock.mockReset();
  });

  it('keeps the halls dock visible when it is the only available POS surface', () => {
    mockSession(['pos_halls.view']);

    renderShell();

    expect(screen.getByRole('link', { name: 'Zallar' }).getAttribute('href')).toBe('/waiter/halls');
  });

  it('keeps single non-hall dock items hidden', () => {
    mockSession(['pos_open_checks.view']);

    renderShell();

    expect(screen.queryByRole('link', { name: 'Hisoblar' })).toBeNull();
  });
});
