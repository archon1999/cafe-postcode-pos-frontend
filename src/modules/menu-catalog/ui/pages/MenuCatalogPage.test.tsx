// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MenuCatalogPage } from './MenuCatalogPage';

const navigateMock = vi.fn();
const navigateElementMock = vi.fn();
const useOptimisticBuilderOrderMock = vi.fn();
const addItemMock = vi.fn();
const removeItemMock = vi.fn();
let searchParamsValue = '';

vi.mock('react-router', () => ({
  Navigate: ({ to, replace }: { to: string; replace?: boolean }) => {
    navigateElementMock({ to, replace });
    return <div>redirect:{to}</div>;
  },
  useNavigate: () => navigateMock,
  useSearchParams: () => [new URLSearchParams(searchParamsValue)],
}));

vi.mock('modules/auth', () => ({
  canAccessTableSessionMenu: () => true,
  canAccessTakeawayBuilder: () => true,
  getPosHomePath: () => '/cashier/builder',
  usePosSession: () => ({
    session: {
      user: { id: 'user-1', fullName: 'Catalog Test' },
      restaurantContext: { serviceFeeEnabled: false, serviceFeePercent: 0, vatEnabled: false, vatPercent: 0 },
    },
    locale: 'uz',
  }),
}));

vi.mock('modules/waiter/application', () => ({
  useCurrentWaiterOrder: () => ({
    currentOrder: {
      id: 'order-1',
      orderNumber: 11,
      status: 'open',
      subtotal: 99000,
      serviceFee: 0,
      total: 99000,
      note: '',
      channel: 'hall',
      tableSession: 'session-1',
      items: [
        {
          id: 'order-item-1',
          catalogItem: 'item-1',
          catalogItemName: 'Burger',
          quantity: 2,
          lineTotal: 99000,
          status: 'new',
          prepStationName: 'Kitchen',
        },
      ],
    },
  }),
  useWaiterMenuQuery: () => ({
    isLoading: false,
    data: [
      {
        id: 'cat-1',
        name: 'Burgers',
        items: [
          {
            id: 'item-1',
            name: 'Burger',
            description: 'Cheese and tomato',
            price: 99000,
            prepStationName: 'Kitchen',
          },
        ],
      },
    ],
  }),
  waiterKeys: {
    orders: ['waiter', 'orders'],
  },
}));

vi.mock('modules/waiter/data-access', () => ({
  waiterRepository: {
    getOrders: vi.fn(),
    createOrder: vi.fn(),
    addOrderItem: vi.fn(),
    removeOrderItem: vi.fn(),
  },
}));

vi.mock('modules/cashier/application', () => ({
  cashierKeys: {
    builderOrders: ['cashier', 'builder-orders'],
  },
  useCashierBuilderOrdersQuery: () => ({ isLoading: false, data: [] }),
  useCashierMenuQuery: () => ({ isLoading: false, data: [] }),
}));

vi.mock('modules/cashier/data-access', () => ({
  cashierRepository: {
    getOpenOrders: vi.fn(),
    createBuilderOrder: vi.fn(),
    addOrderItem: vi.fn(),
    removeOrderItem: vi.fn(),
  },
}));

vi.mock('shared/layout/PosPageFrame', () => ({
  PosPageFrame: ({ header, children }: { header: ReactNode; children: ReactNode }) => (
    <div>
      <div>{header}</div>
      <main>{children}</main>
    </div>
  ),
}));

vi.mock('shared/pos/useOptimisticBuilderOrder', () => ({
  useOptimisticBuilderOrder: (...args: unknown[]) => useOptimisticBuilderOrderMock(...args),
}));

vi.mock('shared/ui/pos-primitives', () => ({
  PosBuilderPageSkeleton: () => <div>loading</div>,
  PosSectionTabs: ({ items }: { items: Array<{ label: string }> }) => (
    <div>{items.map((item) => item.label).join(', ')}</div>
  ),
}));

describe('MenuCatalogPage', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    navigateMock.mockReset();
    navigateElementMock.mockReset();
    addItemMock.mockReset();
    removeItemMock.mockReset();
    searchParamsValue = 'source=waiter&sessionId=session-1';
    useOptimisticBuilderOrderMock.mockReset();
    useOptimisticBuilderOrderMock.mockReturnValue({
      currentOrder: {
        id: 'order-1',
        orderNumber: 11,
        status: 'open',
        subtotal: 99000,
        serviceFee: 0,
        total: 99000,
        note: '',
        channel: 'hall',
        tableSession: 'session-1',
        items: [
          {
            id: 'order-item-1',
            catalogItem: 'item-1',
            catalogItemName: 'Burger',
            quantity: 2,
            lineTotal: 99000,
            status: 'new',
            prepStationName: 'Kitchen',
          },
        ],
      },
      addItem: addItemMock,
      removeItem: removeItemMock,
      hasPendingOperations: false,
    });
  });

  it('redirects missing or invalid source to the POS home path', () => {
    searchParamsValue = 'source=bad';

    render(<MenuCatalogPage />);

    expect(navigateElementMock).toHaveBeenCalledWith({ to: '/cashier/builder', replace: true });
  });

  it('shows product details and selected quantity without prices or totals', () => {
    render(<MenuCatalogPage />);

    expect(screen.getAllByText('Burger').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Cheese and tomato').length).toBeGreaterThan(0);
    expect(screen.getAllByText('x2').length).toBeGreaterThan(0);
    expect(screen.queryByText(/99\s?000/)).toBeNull();
    expect(screen.queryByText(/so'm/)).toBeNull();
  });

  it('adds and removes products through the optimistic order handlers', () => {
    render(<MenuCatalogPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Add one Burger' }));
    expect(addItemMock).toHaveBeenCalledWith(expect.objectContaining({ id: 'item-1' }), '');

    fireEvent.click(screen.getByRole('button', { name: 'Remove Burger' }));
    expect(removeItemMock).toHaveBeenCalledWith('order-item-1');
  });

  it('returns to the source menu path', () => {
    render(<MenuCatalogPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Orqaga' }));

    expect(navigateMock).toHaveBeenCalledWith('/waiter/table-session?sessionId=session-1');
  });
});
