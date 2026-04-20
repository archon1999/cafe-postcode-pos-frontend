// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OpenChecksPageContent } from './OpenChecksPageContent';

const navigateMock = vi.fn();
const openOrdersMock = vi.fn();
const closedOrdersMock = vi.fn();
const updateDisplayNameMutateAsyncMock = vi.fn();
let openOrdersState: Array<Record<string, unknown>> = [];

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
  useCashierUpdateOrderDisplayNameMutation: (options?: { onSuccess?: (orderId: string) => void }) => ({
    isPending: false,
    mutateAsync: async (payload: { orderId: string; displayName: string }) => {
      updateDisplayNameMutateAsyncMock(payload);
      openOrdersState = openOrdersState.map((order) =>
        order.id === payload.orderId ? { ...order, displayName: payload.displayName } : order,
      );
      options?.onSuccess?.(payload.orderId);
      return { id: payload.orderId };
    },
  }),
}));

vi.mock('modules/cashier/domain', () => ({
  groupCashierOrderItemsByStation: () => [['Issiq oshxona', []]],
  getCashierOrderNumberLabel: (order: { orderNumber: number }) => `A${String(order.orderNumber).padStart(5, '0')}`,
  getCashierOrderDisplayName: (order: { orderNumber: number; displayName?: string | null }) =>
    order.displayName?.trim() || `A${String(order.orderNumber).padStart(5, '0')}`,
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
    updateDisplayNameMutateAsyncMock.mockReset();
    openOrdersState = [
      {
        id: 'order-1',
        orderNumber: 101,
        displayName: '',
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
    ];
    openOrdersMock.mockImplementation(() => openOrdersState);
    closedOrdersMock.mockReturnValue([]);
  });

  it('does not show the go-to-menu action for open hall checks', () => {
    render(<OpenChecksPageContent />);

    expect(screen.queryByRole('button', { name: "Menyuga o'tish" })).toBeNull();
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

  it('renames an open check from the dialog and renders the new title', async () => {
    render(<OpenChecksPageContent />);

    fireEvent.click(screen.getByRole('button', { name: "Buyurtma nomini o'zgartirish" }));
    fireEvent.change(screen.getByLabelText('Buyurtma nomi'), { target: { value: '  VIP mijoz  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Saqlash' }));

    expect(updateDisplayNameMutateAsyncMock).toHaveBeenCalledWith({
      orderId: 'order-1',
      displayName: 'VIP mijoz',
    });
    expect((await screen.findAllByText('VIP mijoz')).length).toBeGreaterThan(0);
  });
});
