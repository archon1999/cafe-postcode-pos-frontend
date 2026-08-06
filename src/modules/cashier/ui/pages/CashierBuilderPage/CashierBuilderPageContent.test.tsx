// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CashierBuilderPageContent } from './CashierBuilderPageContent';

const navigateMock = vi.fn();
const useCashierBuilderOrdersQueryMock = vi.fn();
const useCashierMenuQueryMock = vi.fn();
const useCashierPaymentOrderQueryMock = vi.fn();
const useOptimisticBuilderOrderMock = vi.fn();
const submitOrderMutateAsyncMock = vi.fn();
const updateOrderNoteMock = vi.fn();
const updateOrderDeliveryDetailsMock = vi.fn();
const updateOrderChannelMock = vi.fn();
let searchParamsValue = '';
let cachedSearchParamsValue = '';
let cachedSearchParams = new URLSearchParams();

function getSearchParamsMock() {
  if (cachedSearchParamsValue !== searchParamsValue) {
    cachedSearchParamsValue = searchParamsValue;
    cachedSearchParams = new URLSearchParams(searchParamsValue);
  }
  return cachedSearchParams;
}

vi.mock('@iconify/react', () => ({
  Icon: ({ icon }: { icon: string }) => <span data-icon={icon} />,
}));

vi.mock('react-router', () => ({
  useNavigate: () => navigateMock,
  useSearchParams: () => [getSearchParamsMock()],
}));

vi.mock('modules/auth', () => ({
  canCreateCashExpense: () => false,
  canViewCashShift: () => false,
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
  useCashierPaymentOrderQuery: (...args: unknown[]) => useCashierPaymentOrderQueryMock(...args),
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
    updateOrderNote: (...args: unknown[]) => updateOrderNoteMock(...args),
    updateOrderChannel: (...args: unknown[]) => updateOrderChannelMock(...args),
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
    updateOrderNoteMock.mockReset();
    updateOrderNoteMock.mockResolvedValue({ id: 'order-1', note: 'Piyozsiz' });
    updateOrderDeliveryDetailsMock.mockReset();
    updateOrderDeliveryDetailsMock.mockResolvedValue({});
    updateOrderChannelMock.mockReset();
    updateOrderChannelMock.mockResolvedValue({ id: 'order-1', channel: 'hall' });
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
    useCashierPaymentOrderQueryMock.mockReset();
    useCashierPaymentOrderQueryMock.mockReturnValue({
      data: null,
      refetch: vi.fn(),
    });
    useOptimisticBuilderOrderMock.mockReset();
    useOptimisticBuilderOrderMock.mockImplementation((options: { channel: 'delivery' | 'hall' | 'takeaway' }) => ({
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

  it('defaults to hall and renders all channel labels', () => {
    render(<CashierBuilderPageContent />);

    expect(useOptimisticBuilderOrderMock).toHaveBeenCalledWith(expect.objectContaining({ channel: 'hall' }));
    expect(screen.getAllByRole('button', { name: 'Zal' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Soboy' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Dostavka' }).length).toBeGreaterThan(0);
  });

  it('hides the local order id until the server assigns the real order number', () => {
    useOptimisticBuilderOrderMock.mockReturnValue({
      currentOrder: {
        id: 'c0d10c1b-585b-4732-a7fe-3d25094bc14d6e',
        displayName: 'L-c14d6e',
        orderNumber: 1,
        total: 12000,
        subtotal: 12000,
        serviceFee: 0,
        note: '',
        channel: 'hall',
        status: 'open',
        items: [],
      },
      addItem: vi.fn(),
      removeItem: vi.fn(),
      hasPendingOperations: false,
    });

    render(<CashierBuilderPageContent />);

    expect(screen.getAllByText('Buyurtma: Yaratilmoqda...').length).toBeGreaterThan(0);
    expect(screen.queryByText(/L-c14d6e/)).toBeNull();
  });

  it('aggregates matching cart lines while preserving note and status boundaries', () => {
    useOptimisticBuilderOrderMock.mockReturnValue({
      currentOrder: {
        id: 'order-1',
        orderNumber: 7,
        total: 60000,
        subtotal: 60000,
        serviceFee: 0,
        note: '',
        channel: 'hall',
        status: 'open',
        items: [
          {
            id: 'line-1',
            catalogItem: 'item-1',
            catalogItemName: 'Cola',
            quantity: 1,
            lineTotal: 12000,
            status: 'active',
            prepStationName: 'Bar',
            markingRequiredCount: 1,
            markingScannedCount: 1,
          },
          {
            id: 'line-2',
            catalogItem: 'item-1',
            catalogItemName: 'Cola',
            quantity: '2',
            lineTotal: '24000',
            status: 'active',
            prepStationName: 'Bar',
            markingRequiredCount: 2,
            markings: [{ id: 'mark-2' }],
          },
          {
            id: 'line-3',
            catalogItem: 'item-1',
            catalogItemName: 'Cola',
            quantity: 1,
            lineTotal: 12000,
            status: 'active',
            prepStationName: 'Bar',
            note: 'Muzsiz',
          },
          {
            id: 'line-4',
            catalogItem: 'item-1',
            catalogItemName: 'Cola',
            quantity: 1,
            lineTotal: 12000,
            status: 'cancelled',
            prepStationName: 'Bar',
          },
        ],
      },
      addItem: vi.fn(),
      removeItem: vi.fn(),
      hasPendingOperations: false,
    });

    render(<CashierBuilderPageContent />);

    expect(screen.getAllByText('Cola (x3)')).toHaveLength(1);
    expect(screen.getAllByText("36 000 so'm")).toHaveLength(1);
    expect(screen.getAllByText('Markirovka: 2/3')).toHaveLength(1);
    expect(screen.getAllByText('Cola (x1)')).toHaveLength(2);
    expect(screen.getAllByText('Muzsiz')).toHaveLength(1);
  });

  it('switches to a counter hall order without navigating to the halls page', async () => {
    searchParamsValue = 'channel=takeaway';
    render(<CashierBuilderPageContent />);

    fireEvent.click(screen.getByRole('button', { name: 'Zal' }));

    await waitFor(() => {
      expect(useOptimisticBuilderOrderMock).toHaveBeenLastCalledWith(expect.objectContaining({ channel: 'hall' }));
    });
    expect(updateOrderChannelMock).toHaveBeenCalledWith('order-1', 'hall');
    expect(navigateMock).not.toHaveBeenCalledWith('/waiter/halls');
  });

  it('uses payment-first checkout for takeaway', () => {
    searchParamsValue = 'channel=takeaway';

    render(<CashierBuilderPageContent />);

    fireEvent.click(screen.getByRole('button', { name: "To'lov oynasiga o'tish" }));

    expect(submitOrderMutateAsyncMock).not.toHaveBeenCalled();
    expect(updateOrderDeliveryDetailsMock).not.toHaveBeenCalled();
    expect(navigateMock).toHaveBeenCalledWith('/cashier/payment?orderId=order-1');
  });

  it('persists the latest note before opening payment', async () => {
    searchParamsValue = 'channel=takeaway';
    render(<CashierBuilderPageContent />);

    fireEvent.change(screen.getByLabelText('Oshxona uchun izoh'), { target: { value: 'Piyozsiz' } });
    fireEvent.click(screen.getByRole('button', { name: "To'lov oynasiga o'tish" }));

    await waitFor(() => {
      expect(updateOrderNoteMock).toHaveBeenCalledWith('order-1', 'Piyozsiz');
      expect(navigateMock).toHaveBeenCalledWith('/cashier/payment?orderId=order-1');
    });
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
    const saveButtons = screen.getAllByRole('button', { name: 'Saqlash' });
    fireEvent.click(saveButtons[saveButtons.length - 1]);

    expect(screen.getByText('Manzilni kiriting')).toBeTruthy();
    expect(updateOrderDeliveryDetailsMock).not.toHaveBeenCalled();
    expect(submitOrderMutateAsyncMock).not.toHaveBeenCalled();
  });
});
