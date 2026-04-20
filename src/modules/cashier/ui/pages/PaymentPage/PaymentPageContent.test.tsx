// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PaymentPageContent } from './PaymentPageContent';

const navigateMock = vi.fn();
const canAddCashierPaymentOrderItemsMock = vi.fn();
const addPaymentOrderItemMutateAsyncMock = vi.fn();
const updateDisplayNameMutateAsyncMock = vi.fn();

vi.mock('react-router', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('modules/auth', () => ({
  canAddCashierPaymentOrderItems: (...args: unknown[]) => canAddCashierPaymentOrderItemsMock(...args),
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
  useAddCashierPaymentOrderItemMutation: () => ({
    isPending: false,
    mutateAsync: addPaymentOrderItemMutateAsyncMock,
  }),
  useCashierContextQuery: () => ({
    data: { availableCashDesks: [{ id: 'desk-1', name: 'Main cash desk', enabledPaymentMethods: ['cash'] }] },
  }),
  useCashierPaymentMutation: () => ({
    isPending: false,
    isError: false,
    isSuccess: false,
    mutateAsync: vi.fn(),
  }),
  useCashierUpdateOrderDisplayNameMutation: () => ({
    isPending: false,
    mutateAsync: updateDisplayNameMutateAsyncMock,
  }),
  useCashierPaymentOrderQuery: () => ({
    data: {
      id: 'order-1',
      orderNumber: 101,
      displayName: 'VIP mijoz',
      channel: 'takeaway',
      subtotal: 30000,
      serviceFee: 0,
      total: 30000,
      openedByName: 'Ali',
      items: [
        {
          id: 'item-1',
          catalogItem: 'catalog-1',
          catalogItemName: 'Cola style',
          quantity: 1,
          lineTotal: 15000,
          status: 'new',
          note: 'Kamroq tuz',
        },
        {
          id: 'item-2',
          catalogItem: 'catalog-1',
          catalogItemName: 'Cola style',
          quantity: 1,
          lineTotal: 15000,
          status: 'cooking',
          note: 'Kamroq tuz',
        },
      ],
      payments: [],
    },
  }),
}));

vi.mock('modules/cashier/domain', () => ({
  aggregateCashierOrderItems: (items: Array<Record<string, unknown>>) => [
    {
      ...items[0],
      key: 'catalog-1::Kamroq tuz::active::',
      quantity: 2,
      lineTotal: 30000,
    },
  ],
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
  PosOrderChannelSegment: () => <div>segment</div>,
  PosSettingsMenu: () => null,
}));

describe('PaymentPageContent', () => {
  beforeEach(() => {
    cleanup();
    navigateMock.mockReset();
    canAddCashierPaymentOrderItemsMock.mockReset();
    addPaymentOrderItemMutateAsyncMock.mockReset();
    updateDisplayNameMutateAsyncMock.mockReset();
    canAddCashierPaymentOrderItemsMock.mockReturnValue(true);
  });

  it('shows the add-one-more action only when the separate permission is present', () => {
    render(<PaymentPageContent orderId="order-1" />);

    expect(screen.getAllByText('Cola style (x2)')).toHaveLength(1);
    expect(screen.getByRole('button', { name: "Yana qo'shish" })).toBeTruthy();

    cleanup();
    canAddCashierPaymentOrderItemsMock.mockReturnValue(false);

    render(<PaymentPageContent orderId="order-1" />);

    expect(screen.queryByRole('button', { name: "Yana qo'shish" })).toBeNull();
  });

  it('adds one more of the same product from the payment detail list', () => {
    render(<PaymentPageContent orderId="order-1" />);

    fireEvent.click(screen.getByRole('button', { name: "Yana qo'shish" }));

    expect(addPaymentOrderItemMutateAsyncMock).toHaveBeenCalledWith({
      catalogItemId: 'catalog-1',
      note: 'Kamroq tuz',
    });
  });

  it('renders the custom order name as the primary title', () => {
    render(<PaymentPageContent orderId="order-1" />);

    expect(screen.getByText('VIP mijoz')).toBeTruthy();
    expect(screen.getByText('Buyurtma: A00101')).toBeTruthy();
  });
});
