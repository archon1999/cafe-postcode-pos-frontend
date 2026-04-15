// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TableSessionPageContent } from './TableSessionPageContent';

const navigateMock = vi.fn();
const printPrebillMutateAsyncMock = vi.fn();
const submitMutateMock = vi.fn();
const useOptimisticBuilderOrderMock = vi.fn();

vi.mock('react-router', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('modules/auth', () => ({
  canAccessCashierPayments: () => false,
  canAccessTakeawayBuilder: () => true,
  canAccessWaiterMenu: () => true,
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
  usePrintWaiterPrebillMutation: () => ({
    isPending: false,
    mutateAsync: printPrebillMutateAsyncMock,
  }),
  useSubmitWaiterOrderMutation: () => ({
    isPending: false,
    mutate: submitMutateMock,
    mutateAsync: vi.fn(),
  }),
  useWaiterMenuQuery: () => ({
    isLoading: false,
    data: [
      {
        id: 'cat-1',
        name: 'Taomlar',
        items: [{ id: 'item-1', name: 'Osh', price: 30000, prepStationName: 'Issiq oshxona' }],
      },
    ],
  }),
  useWaiterTableSessionQuery: () => ({
    data: { guestCount: 2 },
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
    markReceiptPrintResult: vi.fn(),
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

vi.mock('shared/printing/qzTray', () => ({
  printQzTrayJob: vi.fn(),
}));

vi.mock('shared/ui/pos-primitives', () => ({
  PosBuilderPageSkeleton: () => <div>loading</div>,
  PosIconAction: ({ onClick }: { onClick?: () => void }) => <button onClick={onClick}>icon</button>,
  PosOrderChannelSegment: () => <div>segment</div>,
  PosSectionTabs: ({ items }: { items: Array<{ label: string }> }) => (
    <div>{items.map((item) => item.label).join(', ')}</div>
  ),
  PosSettingsMenu: () => null,
}));

describe('TableSessionPageContent', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    printPrebillMutateAsyncMock.mockReset();
    submitMutateMock.mockReset();
    useOptimisticBuilderOrderMock.mockReset();
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
      hasPendingOperations: false,
    });
  });

  it('replaces the hall close button with prebill print and triggers printing without navigation', async () => {
    printPrebillMutateAsyncMock.mockResolvedValue({
      result: { ok: true },
      receipt: { id: 'receipt-1', status: 'sent', kind: 'prebill' },
    });

    render(<TableSessionPageContent sessionId="session-1" mode="hall" />);

    expect(screen.queryByRole('button', { name: 'Yopish' })).toBeNull();
    const printButtons = screen.getAllByRole('button', { name: 'Chekni chiqarish' });
    expect(printButtons.length).toBeGreaterThan(0);

    fireEvent.click(printButtons[0]);

    expect(printPrebillMutateAsyncMock).toHaveBeenCalledWith('order-1');
    expect(navigateMock).not.toHaveBeenCalledWith('/waiter/halls');
  });

  it('disables the hall print button while optimistic sync is pending', () => {
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

    const printButtons = screen.getAllByRole('button', { name: 'Chekni chiqarish' });
    expect(
      printButtons.some((button) => button.hasAttribute('disabled') || button.getAttribute('aria-disabled') === 'true'),
    ).toBe(true);
  });
});
