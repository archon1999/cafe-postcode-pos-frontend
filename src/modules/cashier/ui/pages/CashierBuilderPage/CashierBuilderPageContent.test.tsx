// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CashierBuilderPageContent } from './CashierBuilderPageContent';

const navigateMock = vi.fn();
const useCashierBuilderOrdersQueryMock = vi.fn();
const useCashierMenuQueryMock = vi.fn();
const useOptimisticBuilderOrderMock = vi.fn();
const submitOrderMutateAsyncMock = vi.fn();
const updateOrderDeliveryDetailsMock = vi.fn();
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
    mutateAsync: submitOrderMutateAsyncMock,
  }),
}));

vi.mock('modules/cashier/data-access', () => ({
  cashierRepository: {
    getOpenOrders: vi.fn(),
    createBuilderOrder: vi.fn(),
    addOrderItem: vi.fn(),
    removeOrderItem: vi.fn(),
    scanOrderMarking: vi.fn(),
    updateOrderDeliveryDetails: (...args: unknown[]) => updateOrderDeliveryDetailsMock(...args),
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
  PosOrderChannelSegment: ({
    channel,
    items,
    onChange,
  }: {
    channel: string;
    items?: Array<{ value: 'delivery' | 'takeaway'; label: string }>;
    onChange?: (channel: 'delivery' | 'takeaway') => void;
  }) => (
    <div>
      <span>{channel}</span>
      {items?.map((item) => (
        <button key={item.value} onClick={() => onChange?.(item.value)}>
          {item.label}
        </button>
      ))}
    </div>
  ),
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
    submitOrderMutateAsyncMock.mockReset();
    updateOrderDeliveryDetailsMock.mockReset();
    updateOrderDeliveryDetailsMock.mockResolvedValue({});
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
    useOptimisticBuilderOrderMock.mockImplementation((options: { channel: 'delivery' | 'takeaway' }) => ({
      currentOrder: {
        id: 'order-1',
        orderNumber: 7,
        total: 12000,
        subtotal: 12000,
        serviceFee: 0,
        note: '',
        channel: options.channel,
        status: 'open',
        items: [],
      },
      addItem: vi.fn(),
      removeItem: vi.fn(),
      hasPendingOperations: false,
    }));
  });

  it('uses the channel query param and opens the price-hidden catalog with that channel', () => {
    searchParamsValue = 'channel=takeaway';

    render(<CashierBuilderPageContent />);

    expect(useOptimisticBuilderOrderMock).toHaveBeenCalledWith(expect.objectContaining({ channel: 'takeaway' }));

    fireEvent.click(screen.getByRole('button', { name: 'solar:chef-hat-bold-duotone' }));

    expect(navigateMock).toHaveBeenCalledWith('/menu/catalog?source=cashier&channel=takeaway');
  });

  it('defaults to takeaway and renders takeaway/delivery channel labels', () => {
    render(<CashierBuilderPageContent />);

    expect(useOptimisticBuilderOrderMock).toHaveBeenCalledWith(expect.objectContaining({ channel: 'takeaway' }));
    expect(screen.getAllByRole('button', { name: 'Olib ketish' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Yetkazib berish' }).length).toBeGreaterThan(0);
  });

  it('uses payment-first checkout for takeaway', () => {
    searchParamsValue = 'channel=takeaway';

    render(<CashierBuilderPageContent />);

    fireEvent.click(screen.getByRole('button', { name: "To'lov oynasiga o'tish" }));

    expect(submitOrderMutateAsyncMock).not.toHaveBeenCalled();
    expect(updateOrderDeliveryDetailsMock).not.toHaveBeenCalled();
    expect(navigateMock).toHaveBeenCalledWith('/cashier/payment?orderId=order-1');
  });

  it('requires valid delivery details before delivery checkout submit', async () => {
    searchParamsValue = 'channel=delivery';

    render(<CashierBuilderPageContent />);

    fireEvent.click(screen.getByRole('button', { name: "To'lov oynasiga o'tish" }));
    fireEvent.change(screen.getByLabelText('Telefon raqam'), { target: { value: '901234567' } });
    fireEvent.change(screen.getByLabelText('Manzil'), { target: { value: '  Chilonzor 12  ' } });
    fireEvent.click(screen.getByRole('button', { name: "To'lov oynasiga o'tish" }));

    await waitFor(() => {
      expect(updateOrderDeliveryDetailsMock).toHaveBeenCalledWith('order-1', {
        deliveryPhone: '90-123-45-67',
        deliveryAddress: 'Chilonzor 12',
      });
    });
    expect(submitOrderMutateAsyncMock).toHaveBeenCalledTimes(1);
    expect(navigateMock).toHaveBeenCalledWith('/cashier/payment?orderId=order-1');
  });

  it('blocks delivery detail confirmation until phone and address are valid', () => {
    searchParamsValue = 'channel=delivery';

    render(<CashierBuilderPageContent />);

    fireEvent.click(screen.getByRole('button', { name: 'Saqlash' }));
    fireEvent.change(screen.getByLabelText('Telefon raqam'), { target: { value: '90123' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Saqlash' }).at(-1)!);

    expect(screen.getByText('Manzilni kiriting')).toBeTruthy();
    expect(updateOrderDeliveryDetailsMock).not.toHaveBeenCalled();
    expect(submitOrderMutateAsyncMock).not.toHaveBeenCalled();
  });
});
