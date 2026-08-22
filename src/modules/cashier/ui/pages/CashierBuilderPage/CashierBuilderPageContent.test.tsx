// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CashierBuilderPageContent } from './CashierBuilderPageContent';

const navigateMock = vi.fn();
const useCashierBuilderOrdersQueryMock = vi.fn();
const useCashierMenuQueryMock = vi.fn();
const useCashierPaymentOrderQueryMock = vi.fn();
const useOptimisticBuilderOrderMock = vi.fn();
const submitOrderMutateAsyncMock = vi.fn();
const createBuilderOrderMock = vi.fn();
const addOrderItemMock = vi.fn();
const addItemMock = vi.fn();
const updateOrderNoteMock = vi.fn();
const updateOrderDeliveryDetailsMock = vi.fn();
const updateOrderChannelMock = vi.fn();
const scanOrderMarkingMock = vi.fn();
const useScannerInputMock = vi.fn();
const requestEdgePrintDocumentsMock = vi.hoisted(() => vi.fn());
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

function dispatchPointer(element: Element, type: string, clientX: number, clientY: number) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX, clientY });
  Object.defineProperties(event, {
    pointerId: { value: 1 },
    pointerType: { value: 'touch' },
  });
  fireEvent(element, event);
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
  useUpdateCashierOrderItemNoteMutation: () => ({ isPending: false, mutate: vi.fn() }),
}));

vi.mock('modules/cashier/data-access', () => ({
  cashierRepository: {
    getOpenOrders: vi.fn(),
    createBuilderOrder: (...args: unknown[]) => createBuilderOrderMock(...args),
    addOrderItem: (...args: unknown[]) => addOrderItemMock(...args),
    removeOrderItem: vi.fn(),
    scanOrderMarking: (...args: unknown[]) => scanOrderMarkingMock(...args),
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
  useScannerInput: (...args: unknown[]) => useScannerInputMock(...args),
}));

vi.mock('modules/edge-printing/application', () => ({
  requestEdgePrintDocuments: requestEdgePrintDocumentsMock,
}));

vi.mock('shared/ui/pos-primitives', async (importOriginal) => {
  const actual = await importOriginal<typeof import('shared/ui/pos-primitives')>();
  return {
    PosMenuItemCard: actual.PosMenuItemCard,
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
    PosItemNoteDialog: ({
      itemLabel,
      onSave,
      open,
    }: {
      itemLabel: string;
      onSave: (note: string) => void;
      open: boolean;
    }) =>
      open ? (
        <div role="dialog" aria-label={`note-${itemLabel}`}>
          <button onClick={() => onSave('Piyozsiz')}>Test note save</button>
        </div>
      ) : null,
    PosSettingsMenu: () => null,
  };
});

describe('CashierBuilderPageContent', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    navigateMock.mockReset();
    submitOrderMutateAsyncMock.mockReset();
    createBuilderOrderMock.mockReset();
    createBuilderOrderMock.mockResolvedValue({ id: 'created-order-1' });
    addOrderItemMock.mockReset();
    addOrderItemMock.mockResolvedValue({});
    addItemMock.mockReset();
    updateOrderNoteMock.mockReset();
    updateOrderNoteMock.mockResolvedValue({ id: 'order-1', note: 'Piyozsiz' });
    updateOrderDeliveryDetailsMock.mockReset();
    updateOrderDeliveryDetailsMock.mockResolvedValue({});
    updateOrderChannelMock.mockReset();
    updateOrderChannelMock.mockResolvedValue({ id: 'order-1', channel: 'hall' });
    scanOrderMarkingMock.mockReset();
    useScannerInputMock.mockReset();
    requestEdgePrintDocumentsMock.mockReset();
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
      addItem: addItemMock,
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

  it('keeps the order note separate from an item-level note', async () => {
    render(<CashierBuilderPageContent />);

    fireEvent.change(screen.getByLabelText('Butun buyurtma uchun izoh'), {
      target: { value: 'Umumiy: tezroq' },
    });
    const options = useOptimisticBuilderOrderMock.mock.calls[
      useOptimisticBuilderOrderMock.mock.calls.length - 1
    ]?.[0] as {
      createOrder: () => Promise<string>;
      addOrderItem: (orderId: string, item: { id: string }, note: string) => Promise<unknown>;
    };

    await expect(options.createOrder()).resolves.toBe('created-order-1');
    await options.addOrderItem('created-order-1', { id: 'item-1' }, 'Piyozsiz');

    expect(createBuilderOrderMock).toHaveBeenCalledWith({ channel: 'hall', note: 'Umumiy: tezroq' });
    expect(addOrderItemMock).toHaveBeenCalledWith('created-order-1', 'item-1', 'Piyozsiz', undefined, undefined);
  });

  it('opens a note dialog after swiping a simple cashier menu item and adds only after note save', () => {
    render(<CashierBuilderPageContent />);

    const card = screen.getByRole('button', { name: /Cola/ });
    dispatchPointer(card, 'pointerdown', 180, 40);
    dispatchPointer(card, 'pointermove', 130, 42);
    dispatchPointer(card, 'pointerup', 90, 43);

    expect(screen.getByRole('dialog', { name: 'note-Cola' })).toBeTruthy();
    expect(addItemMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Test note save' }));

    expect(addItemMock).toHaveBeenCalledWith(expect.objectContaining({ id: 'item-1' }), 'Piyozsiz');
    expect(screen.queryByRole('dialog', { name: 'note-Cola' })).toBeNull();
  });

  it('prints cancellation and replacement documents returned by a marking scan', async () => {
    scanOrderMarkingMock.mockResolvedValue({
      order: {
        id: 'order-1',
        items: [{ id: 'replacement-line', quantity: 2 }],
      },
      kitchenPrintDocuments: ['cancel-old-line', 'dispatch-replacement-line'],
    });

    render(<CashierBuilderPageContent />);
    const latestScannerOptions = useScannerInputMock.mock.calls[useScannerInputMock.mock.calls.length - 1]?.[0] as {
      onScan: (rawCode: string) => Promise<void>;
    };

    await act(async () => {
      await latestScannerOptions.onScan('0101234567890121');
    });

    expect(scanOrderMarkingMock).toHaveBeenCalledWith('order-1', '0101234567890121', 'add');
    expect(requestEdgePrintDocumentsMock).toHaveBeenCalledWith(
      ['cancel-old-line', 'dispatch-replacement-line'],
      expect.any(Function),
    );
  });

  it('defaults to hall and renders all channel labels', () => {
    render(<CashierBuilderPageContent />);

    expect(useOptimisticBuilderOrderMock).toHaveBeenCalledWith(expect.objectContaining({ channel: 'hall' }));
    expect(screen.getAllByRole('button', { name: 'Zal' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Soboy' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Dostavka' }).length).toBeGreaterThan(0);
  });

  it('shows a plain hash instead of #0 when there is no current order', () => {
    useOptimisticBuilderOrderMock.mockReturnValue({
      currentOrder: null,
      addItem: vi.fn(),
      removeItem: vi.fn(),
      hasPendingOperations: false,
    });

    render(<CashierBuilderPageContent />);

    expect(screen.getAllByText('Buyurtma: #').length).toBeGreaterThan(0);
    expect(screen.queryByText('Buyurtma: #0')).toBeNull();
    expect(document.querySelector('[data-order-avatar="#"]')).toBeTruthy();
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
    expect(document.querySelector('[data-order-avatar="#"]')).toBeTruthy();
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

  it('saves a takeaway order without forcing payment', async () => {
    searchParamsValue = 'channel=takeaway';

    render(<CashierBuilderPageContent />);

    fireEvent.click(screen.getByRole('button', { name: 'Saqlash' }));

    await waitFor(() => {
      expect(submitOrderMutateAsyncMock).toHaveBeenCalledTimes(1);
    });
    expect(updateOrderDeliveryDetailsMock).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalledWith('/cashier/payment?orderId=order-1');
  });

  it('persists the latest note before opening payment', async () => {
    searchParamsValue = 'channel=takeaway';
    render(<CashierBuilderPageContent />);

    fireEvent.change(screen.getByLabelText('Butun buyurtma uchun izoh'), { target: { value: 'Piyozsiz' } });
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
