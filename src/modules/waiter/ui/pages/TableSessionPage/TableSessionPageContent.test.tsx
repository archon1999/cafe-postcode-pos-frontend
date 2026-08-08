// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TableSessionPageContent } from './TableSessionPageContent';

const navigateMock = vi.fn();
const submitMutateMock = vi.fn();
const serveReadyMutateMock = vi.fn();
const useWaiterMenuQueryMock = vi.fn();
const useOptimisticBuilderOrderMock = vi.fn();
const canAccessTableSessionMenuMock = vi.fn();

vi.mock('react-router', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('modules/auth', () => ({
  canAccessCashierPayments: () => false,
  canAccessTableSessionMenu: (...args: unknown[]) => canAccessTableSessionMenuMock(...args),
  canAccessTakeawayBuilder: () => true,
  usePosSession: () => ({
    session: { user: { id: 'user-1', fullName: 'Waiter Test' } },
    locale: 'uz',
    setLocale: vi.fn(),
    setSession: vi.fn(),
    themeMode: 'light',
    setThemeMode: vi.fn(),
  }),
}));

vi.mock('modules/waiter/application', () => ({
  useCurrentWaiterOrder: () => ({ currentOrder: undefined }),
  useCurrentWaiterTakeawayOrder: () => ({ currentOrder: undefined }),
  useSubmitWaiterOrderMutation: () => ({
    isPending: false,
    mutate: submitMutateMock,
    mutateAsync: vi.fn(),
  }),
  useServeReadyWaiterItemsMutation: () => ({
    isPending: false,
    mutate: serveReadyMutateMock,
  }),
  useWaiterMenuQuery: (...args: unknown[]) => useWaiterMenuQueryMock(...args),
  useWaiterTableSessionQuery: () => ({
    data: { guestCount: 2, tableName: 'VIP stol', tableNumber: 7 },
  }),
  waiterKeys: {
    orders: ['waiter', 'orders'],
  },
}));

vi.mock('modules/waiter/data-access', () => ({
  waiterRepository: {
    getOrders: vi.fn(),
    createOrder: vi.fn(),
    createTakeawayOrder: vi.fn(),
    removeOrderItem: vi.fn(),
    addOrderItem: vi.fn(),
  },
}));

vi.mock('modules/waiter/domain', async () => {
  const actual = await vi.importActual<typeof import('modules/waiter/domain')>('modules/waiter/domain');
  return {
    ...actual,
    getDefaultWaiterMenuCategory: (categories: Array<{ id: string }>) => categories[0],
    groupWaiterOrderItemsByStation: () => [['Issiq oshxona', []]],
  };
});

vi.mock('shared/layout/PosPageFrame', () => ({
  PosPageFrame: ({ header, children }: { header: ReactNode; children: ReactNode }) => (
    <div>
      <div>{header}</div>
      <div>{children}</div>
    </div>
  ),
}));

vi.mock('shared/pos/useOptimisticBuilderOrder', () => ({
  useOptimisticBuilderOrder: (...args: unknown[]) => useOptimisticBuilderOrderMock(...args),
}));

vi.mock('shared/ui/pos-primitives', () => ({
  PosBuilderPageSkeleton: () => <div>loading</div>,
  PosIconAction: ({ icon, onClick }: { icon: string; onClick?: () => void }) => (
    <button aria-label={icon} onClick={onClick}>
      {icon}
    </button>
  ),
  PosOrderChannelSegment: ({
    channel,
    items = [],
  }: {
    channel: string;
    items?: Array<{ value: string; label: string }>;
  }) => (
    <div>
      {items.map((item) => (
        <span key={item.value} aria-current={item.value === channel ? 'true' : undefined}>
          {item.label}
        </span>
      ))}
    </div>
  ),
  PosSectionTabs: ({ items }: { items: Array<{ label: string }> }) => (
    <div>{items.map((item) => item.label).join(', ')}</div>
  ),
  PosSettingsMenu: () => null,
}));

describe('TableSessionPageContent', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    navigateMock.mockReset();
    submitMutateMock.mockReset();
    serveReadyMutateMock.mockReset();
    canAccessTableSessionMenuMock.mockReset();
    canAccessTableSessionMenuMock.mockReturnValue(true);
    useWaiterMenuQueryMock.mockReset();
    useWaiterMenuQueryMock.mockReturnValue({
      isLoading: false,
      data: [
        {
          id: 'cat-1',
          name: 'Taomlar',
          items: [{ id: 'item-1', name: 'Osh', price: 30000, prepStationName: 'Issiq oshxona' }],
        },
      ],
    });
    useOptimisticBuilderOrderMock.mockReset();
    useOptimisticBuilderOrderMock.mockReturnValue({
      currentOrder: {
        id: 'order-1',
        orderNumber: 101,
        total: 33000,
        subtotal: 30000,
        serviceFeePercent: 10,
        serviceFee: 3000,
        vatEnabled: true,
        vatPercent: 12,
        vatAmount: 3536,
        items: [
          {
            id: 'order-item-1',
            catalogItem: 'item-1',
            catalogItemName: 'Osh',
            quantity: 1,
            lineTotal: 30000,
            status: 'new',
            prepStationName: 'Issiq oshxona',
            kitchenDispatched: false,
          },
        ],
        channel: 'hall',
      },
      addItem: vi.fn(),
      removeItem: vi.fn(),
      hasPendingOperations: false,
    });
  });

  it('submits hall orders without exposing a waiter receipt action', () => {
    render(<TableSessionPageContent sessionId="session-1" mode="hall" />);

    expect(screen.queryByRole('button', { name: 'Yopish' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Chekni chiqarish' })).toBeNull();
    const submitButtons = screen.getAllByRole('button', { name: /Saqlash/ });
    expect(submitButtons.length).toBeGreaterThan(0);

    fireEvent.click(submitButtons[0]);

    expect(submitMutateMock).toHaveBeenCalledTimes(1);
  });

  it('enables the hall menu query for hall-session access', () => {
    render(<TableSessionPageContent sessionId="session-1" mode="hall" />);

    expect(canAccessTableSessionMenuMock).toHaveBeenCalledWith(expect.objectContaining({ id: 'user-1' }));
    expect(useWaiterMenuQueryMock).toHaveBeenCalledWith({ enabled: true });
  });

  it('shows the table number and the three-channel segment with hall active', () => {
    render(<TableSessionPageContent sessionId="session-1" mode="hall" />);

    expect(screen.getByText('7')).toBeTruthy();
    expect(screen.getByText('Zal').getAttribute('aria-current')).toBe('true');
    expect(screen.getByText('Soboy')).toBeTruthy();
    expect(screen.getByText('Dostavka')).toBeTruthy();
  });

  it('opens the price-hidden catalog for the current table session', () => {
    render(<TableSessionPageContent sessionId="session-1" mode="hall" />);

    fireEvent.click(screen.getByRole('button', { name: 'solar:chef-hat-bold-duotone' }));

    expect(navigateMock).toHaveBeenCalledWith('/menu/catalog?source=waiter&sessionId=session-1');
  });

  it('renders menu item images like the cashier builder', () => {
    useWaiterMenuQueryMock.mockReturnValue({
      isLoading: false,
      data: [
        {
          id: 'cat-1',
          name: 'Taomlar',
          items: [
            {
              id: 'item-1',
              name: 'Osh',
              price: 30000,
              prepStationName: 'Issiq oshxona',
              imageUrl: 'https://cdn.example.com/osh.png',
            },
          ],
        },
      ],
    });

    render(<TableSessionPageContent sessionId="session-1" mode="hall" />);

    expect(screen.getByRole('img', { name: 'Osh' }).getAttribute('src')).toBe('https://cdn.example.com/osh.png');
  });

  it('shows included VAT in the order summary without changing the grand total', () => {
    render(<TableSessionPageContent sessionId="session-1" mode="hall" />);

    expect(screen.getAllByText('QQS (12%):').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/3\s536 so'm/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/33\s000 so'm/).length).toBeGreaterThan(0);
  });

  it('disables hall submission while optimistic sync is pending', () => {
    useOptimisticBuilderOrderMock.mockReturnValue({
      currentOrder: {
        id: 'order-1',
        orderNumber: 101,
        total: 33000,
        subtotal: 30000,
        serviceFeePercent: 10,
        items: [],
        channel: 'hall',
      },
      addItem: vi.fn(),
      removeItem: vi.fn(),
      hasPendingOperations: true,
    });

    render(<TableSessionPageContent sessionId="session-1" mode="hall" />);

    const submitButtons = screen.getAllByRole('button', { name: /Saqlash/ });
    expect(
      submitButtons.some(
        (button) => button.hasAttribute('disabled') || button.getAttribute('aria-disabled') === 'true',
      ),
    ).toBe(true);
    expect(screen.queryByRole('button', { name: 'Chekni chiqarish' })).toBeNull();
  });

  it('lets the waiter mark ready dispatched items as served', () => {
    useOptimisticBuilderOrderMock.mockReturnValue({
      currentOrder: {
        id: 'order-1',
        orderNumber: 101,
        total: 33000,
        subtotal: 30000,
        serviceFeePercent: 10,
        items: [
          {
            id: 'ready-item',
            catalogItem: 'item-1',
            catalogItemName: 'Osh',
            quantity: 1,
            lineTotal: 30000,
            status: 'done',
            prepStationName: 'Issiq oshxona',
            kitchenDispatched: true,
          },
        ],
        channel: 'hall',
      },
      addItem: vi.fn(),
      removeItem: vi.fn(),
      hasPendingOperations: false,
    });

    render(<TableSessionPageContent sessionId="session-1" mode="hall" />);
    fireEvent.click(screen.getAllByRole('button', { name: /Tayyorlarini stolga berdim/ })[0]);

    expect(serveReadyMutateMock).toHaveBeenCalledTimes(1);
  });
});
