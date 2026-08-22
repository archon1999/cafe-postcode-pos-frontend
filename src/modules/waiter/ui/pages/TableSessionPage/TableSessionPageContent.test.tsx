// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TableSessionPageContent } from './TableSessionPageContent';

const navigateMock = vi.fn();
const submitMutateMock = vi.fn();
const printPrecheckMutateMock = vi.fn();
const useWaiterMenuQueryMock = vi.fn();
const useWaiterTableSessionQueryMock = vi.fn();
const useOptimisticBuilderOrderMock = vi.fn();
const canAccessTableSessionMenuMock = vi.fn();
const createOrderMock = vi.fn();
const addOrderItemMock = vi.fn();
const optimisticAddItemMock = vi.fn();
let submitMutationOptions: { onSuccess?: () => void } | undefined;

function dispatchPointer(element: Element, type: string, clientX: number, clientY: number) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX, clientY });
  Object.defineProperties(event, {
    pointerId: { value: 1 },
    pointerType: { value: 'touch' },
  });
  fireEvent(element, event);
}

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
  usePrintWaiterPrecheckMutation: () => ({
    isPending: false,
    mutate: printPrecheckMutateMock,
  }),
  useSubmitWaiterOrderMutation: (options: { onSuccess?: () => void }) => {
    submitMutationOptions = options;
    return {
      isPending: false,
      mutate: submitMutateMock,
      mutateAsync: vi.fn(),
    };
  },
  useUpdateWaiterOrderItemNoteMutation: () => ({ isPending: false, mutate: vi.fn() }),
  useWaiterMenuQuery: (...args: unknown[]) => useWaiterMenuQueryMock(...args),
  useWaiterTableSessionQuery: (...args: unknown[]) => useWaiterTableSessionQueryMock(...args),
  waiterKeys: {
    orders: ['waiter', 'orders'],
  },
}));

vi.mock('modules/waiter/data-access', () => ({
  waiterRepository: {
    getOrders: vi.fn(),
    createOrder: (...args: unknown[]) => createOrderMock(...args),
    createTakeawayOrder: vi.fn(),
    removeOrderItem: vi.fn(),
    addOrderItem: (...args: unknown[]) => addOrderItemMock(...args),
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

describe('TableSessionPageContent', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    navigateMock.mockReset();
    submitMutateMock.mockReset();
    submitMutationOptions = undefined;
    printPrecheckMutateMock.mockReset();
    createOrderMock.mockReset();
    createOrderMock.mockResolvedValue({ id: 'created-order-1' });
    addOrderItemMock.mockReset();
    addOrderItemMock.mockResolvedValue({});
    optimisticAddItemMock.mockReset();
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
    useWaiterTableSessionQueryMock.mockReset();
    useWaiterTableSessionQueryMock.mockReturnValue({
      data: {
        guestCount: 2,
        tableName: 'VIP stol',
        tableNumber: 7,
        hallName: 'VIP zal',
        zoneName: 'VIP kabina',
        showZoneName: true,
      },
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
        items: [],
        channel: 'hall',
      },
      addItem: optimisticAddItemMock,
      removeItem: vi.fn(),
      hasPendingOperations: false,
    });
  });

  it('shows a waiter precheck action next to save without replacing order submission', () => {
    render(<TableSessionPageContent sessionId="session-1" mode="hall" />);

    expect(screen.queryByRole('button', { name: 'Yopish' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Chekni chiqarish' })).toBeNull();
    const precheckButtons = screen.getAllByRole('button', { name: 'Prechek' });
    const submitButtons = screen.getAllByRole('button', { name: 'Saqlash' });
    expect(precheckButtons.length).toBeGreaterThan(0);
    expect(submitButtons.length).toBeGreaterThan(0);

    fireEvent.click(precheckButtons[0]);
    fireEvent.click(submitButtons[0]);

    expect(printPrecheckMutateMock).toHaveBeenCalledTimes(1);
    expect(submitMutateMock).toHaveBeenCalledTimes(1);
  });

  it('keeps the table order note separate from an item-level note', async () => {
    render(<TableSessionPageContent sessionId="session-1" mode="hall" />);

    fireEvent.change(screen.getAllByLabelText('Butun buyurtma uchun izoh')[0], {
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

    expect(createOrderMock).toHaveBeenCalledWith('session-1', 'Umumiy: tezroq');
    expect(addOrderItemMock).toHaveBeenCalledWith('created-order-1', 'item-1', 'Piyozsiz', undefined, undefined);
  });

  it('opens a note dialog after swiping a simple menu item and adds only after note save', () => {
    render(<TableSessionPageContent sessionId="session-1" mode="hall" />);

    const card = screen.getByText('Osh').closest('[role="button"]');
    expect(card).toBeTruthy();
    dispatchPointer(card as Element, 'pointerdown', 180, 40);
    dispatchPointer(card as Element, 'pointermove', 120, 42);
    dispatchPointer(card as Element, 'pointerup', 80, 43);

    expect(screen.getByRole('dialog', { name: 'note-Osh' })).toBeTruthy();
    expect(optimisticAddItemMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Test note save' }));

    expect(optimisticAddItemMock).toHaveBeenCalledWith(expect.objectContaining({ id: 'item-1' }), 'Piyozsiz');
    expect(screen.queryByRole('dialog', { name: 'note-Osh' })).toBeNull();
  });

  it('enables the hall menu query for hall-session access', () => {
    render(<TableSessionPageContent sessionId="session-1" mode="hall" />);

    expect(canAccessTableSessionMenuMock).toHaveBeenCalledWith(expect.objectContaining({ id: 'user-1' }));
    expect(useWaiterMenuQueryMock).toHaveBeenCalledWith({ enabled: true });
  });

  it('returns the waiter to halls after a hall order is saved successfully', () => {
    submitMutateMock.mockImplementation(() => submitMutationOptions?.onSuccess?.());
    render(<TableSessionPageContent sessionId="session-1" mode="hall" />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Saqlash' })[0]);

    expect(navigateMock).toHaveBeenCalledWith('/waiter/halls', { replace: true });
  });

  it('shows the table and emphasized hall location without the order label or channel tabs', () => {
    render(<TableSessionPageContent sessionId="session-1" mode="hall" />);

    expect(screen.getByText('7')).toBeTruthy();
    expect(screen.getByText('VIP kabina')).toBeTruthy();
    expect(screen.getByText('VIP zal')).toBeTruthy();
    expect(screen.queryByText('VIP kabina · VIP zal')).toBeNull();
    expect(document.querySelector('[data-location-level="zone"]')?.textContent).toBe('VIP kabina');
    expect(document.querySelector('[data-location-level="hall"]')?.textContent).toBe('VIP zal');
    expect(document.querySelectorAll('[data-location-emphasis="true"]').length).toBeGreaterThan(0);
    expect(screen.queryByText(/Buyurtma:/)).toBeNull();
    expect(screen.queryByText('Zal')).toBeNull();
    expect(screen.queryByText('Soboy')).toBeNull();
    expect(screen.queryByText('Dostavka')).toBeNull();
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

  it('shows all configured service fee rows before the first item creates an order', () => {
    useWaiterTableSessionQueryMock.mockReturnValue({
      data: {
        guestCount: 2,
        tableName: 'VIP stol',
        tableNumber: 7,
        hallName: 'VIP zal',
        zoneName: 'VIP kabina',
        showZoneName: true,
        serviceFeeComponents: [
          { scope: 'restaurant', percent: 10 },
          { scope: 'hall', percent: 3 },
          { scope: 'table', percent: 2 },
        ],
      },
    });
    useOptimisticBuilderOrderMock.mockReturnValue({
      currentOrder: undefined,
      addItem: vi.fn(),
      removeItem: vi.fn(),
      hasPendingOperations: false,
    });

    render(<TableSessionPageContent sessionId="session-1" mode="hall" />);

    expect(screen.getAllByText('Restoran xizmat haqi (10%):').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Zal xizmat haqi (3%):').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Stol xizmat haqi (2%):').length).toBeGreaterThan(0);
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

    const submitButtons = screen.getAllByRole('button', { name: 'Saqlash' });
    expect(
      submitButtons.some(
        (button) => button.hasAttribute('disabled') || button.getAttribute('aria-disabled') === 'true',
      ),
    ).toBe(true);
    expect(
      screen
        .getAllByRole('button', { name: 'Prechek' })
        .some((button) => button.hasAttribute('disabled') || button.getAttribute('aria-disabled') === 'true'),
    ).toBe(true);
  });
});
