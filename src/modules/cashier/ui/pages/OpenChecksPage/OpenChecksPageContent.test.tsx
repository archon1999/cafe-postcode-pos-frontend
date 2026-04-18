// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OpenChecksPageContent } from './OpenChecksPageContent';

const navigateMock = vi.fn();
const openOrdersMock = vi.fn();
const closedOrdersMock = vi.fn();

vi.mock('react-router', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('modules/auth', () => ({
  canAccessTakeawayBuilder: () => false,
  canManageCashierPayments: () => true,
  usePosSession: () => ({
    session: { user: { id: 'cashier-1', fullName: 'Cashier Test', permissionCodes: ['pos_open_checks.view'] } },
    locale: 'uz',
    setLocale: vi.fn(),
    setSession: vi.fn(),
    themeMode: 'light',
    setThemeMode: vi.fn(),
  }),
}));

vi.mock('modules/cashier/application', () => ({
  useCashierOpenChecksQuery: (status: 'open' | 'closed') => ({
    isLoading: false,
    data: status === 'open' ? openOrdersMock() : closedOrdersMock(),
  }),
  useCashierRefundMutation: () => ({
    isPending: false,
    mutate: vi.fn(),
  }),
  useCashierReprintMutation: () => ({
    isPending: false,
    mutate: vi.fn(),
  }),
}));

vi.mock('modules/cashier/domain', () => ({
  groupCashierOrderItemsByStation: () => [['Issiq oshxona', []]],
}));

vi.mock('shared/layout/PosPageFrame', () => ({
  PosPageFrame: ({ header, children }: { header: ReactNode; children: ReactNode }) => (
    <div>
      <div>{header}</div>
      <div>{children}</div>
    </div>
  ),
}));

vi.mock('shared/ui/pos-primitives', () => ({
  PosIconAction: ({ onClick }: { onClick?: () => void }) => <button onClick={onClick}>icon</button>,
  PosOpenChecksSkeleton: () => <div>loading</div>,
  PosOrderChannelSegment: () => <div>segment</div>,
  PosSectionTabs: ({
    value,
    items,
    onChange,
  }: {
    value: string;
    items: Array<{ value: string; label: string }>;
    onChange: (value: string) => void;
  }) => (
    <div>
      {items.map((item) => (
        <button key={item.value} data-selected={value === item.value} onClick={() => onChange(item.value)}>
          {item.label}
        </button>
      ))}
    </div>
  ),
  PosSettingsMenu: () => null,
}));

describe('OpenChecksPageContent', () => {
  beforeEach(() => {
    cleanup();
    navigateMock.mockReset();
    openOrdersMock.mockReset();
    closedOrdersMock.mockReset();
    openOrdersMock.mockReturnValue([
      {
        id: 'order-1',
        orderNumber: 101,
        status: 'open',
        subtotal: 30000,
        serviceFee: 3000,
        total: 33000,
        note: '',
        channel: 'hall',
        items: [],
        tableSession: 'session-1',
        tableName: 'Stol 7',
        guestCount: 3,
        openedByName: 'Ali',
        createdAt: '2026-04-18T10:00:00Z',
        payments: [],
        receipts: [],
      },
    ]);
    closedOrdersMock.mockReturnValue([]);
  });

  it('shows the go-to-menu action for open hall checks and navigates to the session editor', () => {
    render(<OpenChecksPageContent />);

    const button = screen.getByRole('button', { name: "Menyuga o'tish" });
    fireEvent.click(button);

    expect(navigateMock).toHaveBeenCalledWith('/waiter/table-session?sessionId=session-1&source=cashier');
  });

  it('hides the go-to-menu action for closed checks', () => {
    openOrdersMock.mockReturnValue([]);
    closedOrdersMock.mockReturnValue([
      {
        id: 'order-3',
        orderNumber: 103,
        status: 'closed',
        subtotal: 20000,
        serviceFee: 2000,
        total: 22000,
        note: '',
        channel: 'hall',
        items: [],
        tableSession: 'session-3',
        tableName: 'Stol 3',
        guestCount: 2,
        openedByName: 'Vali',
        createdAt: '2026-04-18T09:00:00Z',
        closedAt: '2026-04-18T09:30:00Z',
        payments: [{ id: 'payment-1', amount: 22000, status: 'succeeded', method: 'cash' }],
        receipts: [{ id: 'receipt-1', status: 'sent', payload: { receiptNumber: 'R-1' } }],
      },
    ]);

    render(<OpenChecksPageContent />);

    expect(screen.queryByRole('button', { name: "Menyuga o'tish" })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Yopiq hisoblar/ }));

    expect(screen.queryByRole('button', { name: "Menyuga o'tish" })).toBeNull();
  });
});
