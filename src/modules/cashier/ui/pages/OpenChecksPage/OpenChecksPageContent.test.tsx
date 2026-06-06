// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OpenChecksPageContent } from './OpenChecksPageContent';

const navigateMock = vi.fn();
const openOrdersMock = vi.fn();
const closedOrdersMock = vi.fn();
const fiscalUnresolvedOrdersMock = vi.fn();
const updateDisplayNameMutateAsyncMock = vi.fn();
const retryFiscalMutateMock = vi.fn();
const fiscalUnresolvedRefetchMock = vi.fn();
const printReceiptWithFallbackMock = vi.fn(() => Promise.resolve(true));
let openOrdersState: Array<Record<string, unknown>> = [];

vi.mock('react-router', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('@iconify/react', () => ({
  Icon: () => <span />,
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
  useCashierContextQuery: () => ({
    data: {
      availableCashDesks: [
        {
          id: 'desk-1',
          name: 'Main cash desk',
          enabledPaymentMethods: ['cash'],
          printerIntegration: 'printer-1',
        },
      ],
      currentShift: { cashDesk: 'desk-1' },
    },
  }),
  useCashierOpenChecksQuery: (status: 'open' | 'closed' | 'fiscal_unresolved') => ({
    isLoading: false,
    data:
      status === 'open'
        ? openOrdersMock()
        : status === 'fiscal_unresolved'
          ? fiscalUnresolvedOrdersMock()
          : closedOrdersMock(),
    refetch: status === 'fiscal_unresolved' ? fiscalUnresolvedRefetchMock : vi.fn(),
  }),
  useCashierFiscalRetryMutation: (options?: { onSuccess?: (response: Record<string, unknown>) => void }) => ({
    isPending: false,
    mutate: (paymentId: string) => {
      retryFiscalMutateMock(paymentId);
      options?.onSuccess?.({
        results: [],
        receipts: [{ id: 'receipt-2', payload: { receiptNumber: 'R-2' } }],
      });
    },
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

vi.mock('shared/printing/browserReceipt', () => ({
  printReceiptWithFallback: (...args: unknown[]) => printReceiptWithFallbackMock(...args),
}));

describe('OpenChecksPageContent', () => {
  beforeEach(() => {
    cleanup();
    navigateMock.mockReset();
    openOrdersMock.mockReset();
    closedOrdersMock.mockReset();
    fiscalUnresolvedOrdersMock.mockReset();
    updateDisplayNameMutateAsyncMock.mockReset();
    retryFiscalMutateMock.mockReset();
    fiscalUnresolvedRefetchMock.mockReset();
    printReceiptWithFallbackMock.mockClear();
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
    fiscalUnresolvedOrdersMock.mockReturnValue([]);
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

  it('asks whether to print after finishing the retry receipt dialog', async () => {
    openOrdersMock.mockReturnValue([]);
    fiscalUnresolvedOrdersMock.mockReturnValue([
      {
        id: 'order-4',
        orderNumber: 104,
        status: 'fiscal_unresolved',
        subtotal: 20000,
        serviceFee: 0,
        total: 20000,
        note: '',
        channel: 'hall',
        items: [],
        tableSession: 'session-4',
        tableName: 'Stol 4',
        guestCount: 2,
        openedByName: 'Ali',
        createdAt: '2026-04-18T09:00:00Z',
        payments: [{ id: 'payment-4', amount: 20000, status: 'succeeded', method: 'cash' }],
        receipts: [],
      },
    ]);

    render(<OpenChecksPageContent />);
    fireEvent.click(screen.getByRole('button', { name: /Yopilmagan hisoblar/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Fiscalga qayta yuborish' }));

    expect(await screen.findByText('Chek tayyor')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Chekni chiqarish' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Yakunlash' }));
    expect(await screen.findByText('Chek kerakmi?')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Ha, chiqarish' }));

    await waitFor(() => {
      expect(printReceiptWithFallbackMock).toHaveBeenCalledWith(
        { receiptNumber: 'R-2' },
        { preferLocalAgent: true, receiptId: 'receipt-2' },
      );
      expect(fiscalUnresolvedRefetchMock).toHaveBeenCalled();
    });
  });

  it('can finish the retry receipt dialog without printing', async () => {
    openOrdersMock.mockReturnValue([]);
    fiscalUnresolvedOrdersMock.mockReturnValue([
      {
        id: 'order-5',
        orderNumber: 105,
        status: 'fiscal_unresolved',
        subtotal: 25000,
        serviceFee: 0,
        total: 25000,
        note: '',
        channel: 'hall',
        items: [],
        tableSession: 'session-5',
        tableName: 'Stol 5',
        guestCount: 2,
        openedByName: 'Ali',
        createdAt: '2026-04-18T09:00:00Z',
        payments: [{ id: 'payment-5', amount: 25000, status: 'succeeded', method: 'cash' }],
        receipts: [],
      },
    ]);

    render(<OpenChecksPageContent />);
    fireEvent.click(screen.getByRole('button', { name: /Yopilmagan hisoblar/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Fiscalga qayta yuborish' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Yakunlash' }));
    fireEvent.click(await screen.findByRole('button', { name: "Yo'q" }));

    expect(printReceiptWithFallbackMock).not.toHaveBeenCalled();
    expect(fiscalUnresolvedRefetchMock).toHaveBeenCalled();
  });
});
