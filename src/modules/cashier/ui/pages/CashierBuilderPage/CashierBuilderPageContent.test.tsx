// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CashierBuilderPageContent } from './CashierBuilderPageContent';

const navigateMock = vi.fn();
const useCashierBuilderOrdersQueryMock = vi.fn();
const useCashierMenuQueryMock = vi.fn();
const useOptimisticBuilderOrderMock = vi.fn();
let searchParamsValue = '';

vi.mock('react-router', () => ({
  useNavigate: () => navigateMock,
  useSearchParams: () => [new URLSearchParams(searchParamsValue)],
}));

vi.mock('modules/auth', () => ({
  usePosSession: () => ({
    session: {
      user: { id: 'user-1', fullName: 'Cashier Test' },
      restaurantContext: { serviceFeeEnabled: false, serviceFeePercent: 0, vatEnabled: false, vatPercent: 0 },
    },
    locale: 'uz',
    setLocale: vi.fn(),
    setSession: vi.fn(),
    themeMode: 'light',
    setThemeMode: vi.fn(),
  }),
}));

vi.mock('modules/cashier/application', () => ({
  cashierKeys: {
    builderOrders: ['cashier', 'builder-orders'],
    menu: ['cashier', 'menu'],
  },
  useCashierBuilderOrdersQuery: (...args: unknown[]) => useCashierBuilderOrdersQueryMock(...args),
  useCashierMenuQuery: (...args: unknown[]) => useCashierMenuQueryMock(...args),
  useSubmitCashierOrderMutation: () => ({
    isPending: false,
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
  }),
}));

vi.mock('modules/cashier/data-access', () => ({
  cashierRepository: {
    getOpenOrders: vi.fn(),
    createBuilderOrder: vi.fn(),
    addOrderItem: vi.fn(),
    removeOrderItem: vi.fn(),
    scanOrderMarking: vi.fn(),
  },
}));

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

vi.mock('shared/pos/useScannerInput', () => ({
  useScannerInput: vi.fn(),
}));

vi.mock('shared/ui/pos-primitives', () => ({
  PosBuilderPageSkeleton: () => <div>loading</div>,
  PosIconAction: ({ icon, onClick }: { icon: string; onClick?: () => void }) => (
    <button aria-label={icon} onClick={onClick}>
      {icon}
    </button>
  ),
  PosOrderChannelSegment: ({ channel }: { channel: string }) => <div>{channel}</div>,
  PosSectionTabs: ({ items }: { items: Array<{ label: string }> }) => (
    <div>{items.map((item) => item.label).join(', ')}</div>
  ),
  PosSettingsMenu: () => null,
}));

describe('CashierBuilderPageContent', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    navigateMock.mockReset();
    searchParamsValue = '';
    useCashierMenuQueryMock.mockReset();
    useCashierMenuQueryMock.mockReturnValue({
      isLoading: false,
      data: [
        {
          id: 'cat-1',
          name: 'Ichimliklar',
          items: [{ id: 'item-1', name: 'Cola', price: 12000, prepStationName: 'Bar' }],
        },
      ],
    });
    useCashierBuilderOrdersQueryMock.mockReset();
    useCashierBuilderOrdersQueryMock.mockReturnValue({
      isLoading: false,
      data: [],
      refetch: vi.fn(),
    });
    useOptimisticBuilderOrderMock.mockReset();
    useOptimisticBuilderOrderMock.mockReturnValue({
      currentOrder: {
        id: 'order-1',
        orderNumber: 7,
        total: 12000,
        subtotal: 12000,
        serviceFee: 0,
        note: '',
        channel: 'delivery',
        status: 'open',
        items: [],
      },
      addItem: vi.fn(),
      removeItem: vi.fn(),
      hasPendingOperations: false,
    });
  });

  it('uses the channel query param and opens the price-hidden catalog with that channel', () => {
    searchParamsValue = 'channel=takeaway';

    render(<CashierBuilderPageContent />);

    expect(useOptimisticBuilderOrderMock).toHaveBeenCalledWith(expect.objectContaining({ channel: 'takeaway' }));

    fireEvent.click(screen.getByRole('button', { name: 'solar:chef-hat-bold-duotone' }));

    expect(navigateMock).toHaveBeenCalledWith('/menu/catalog?source=cashier&channel=takeaway');
  });
});
