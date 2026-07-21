// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OpenChecksPageContent } from './OpenChecksPageContent';

const navigateMock = vi.fn();
const openOrdersMock = vi.fn();
const closedOrdersMock = vi.fn();
const fiscalClosedOrdersMock = vi.fn();
const updateDisplayNameMutateAsyncMock = vi.fn();
const retryFiscalMutateMock = vi.fn();
const closedRefetchMock = vi.fn();
const fiscalClosedRefetchMock = vi.fn();
const ensurePrintDocumentMutateAsyncMock = vi.fn();
const edgePrintMutateAsyncMock = vi.fn(() => Promise.resolve({ status: 'succeeded' }));
const refundMutateAsyncMock = vi.fn();
let openOrdersState: Array<Record<string, unknown>> = [];
let fiscalDeviceOnlineMock = true;

vi.mock('react-router', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('@iconify/react', () => ({
  Icon: () => <span />,
}));

vi.mock('@mui/material', async () => {
  const actual = await vi.importActual<typeof import('@mui/material')>('@mui/material');
  const StaticOverlay = ({ open, children }: { open: boolean; children?: ReactNode }) =>
    open ? <div>{children}</div> : null;

  return {
    ...actual,
    Dialog: StaticOverlay,
    Drawer: StaticOverlay,
  };
});

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
          fiscalProvider: 'fiscal-drive-service',
          printerIntegration: 'printer-1',
        },
      ],
      currentShift: { cashDesk: 'desk-1' },
      fiscalDeviceStatus: { online: fiscalDeviceOnlineMock },
    },
  }),
  useCashierOpenChecksQuery: (status: 'open' | 'closed' | 'fiscal_closed') => ({
    isLoading: false,
    data:
      status === 'open' ? openOrdersMock() : status === 'fiscal_closed' ? fiscalClosedOrdersMock() : closedOrdersMock(),
    refetch: status === 'closed' ? closedRefetchMock : status === 'fiscal_closed' ? fiscalClosedRefetchMock : vi.fn(),
  }),
  useCashierFiscalRetryMutation: (options?: { onSuccess?: (response: Record<string, unknown>) => void }) => ({
    isPending: false,
    mutate: (paymentId: string) => {
      retryFiscalMutateMock(paymentId);
      options?.onSuccess?.({
        results: [],
        receipts: [{ id: 'receipt-2', printDocument: 'document-2', payload: { receiptNumber: 'R-2' } }],
      });
    },
  }),
  useCashierRefundMutation: () => ({
    isPending: false,
    mutateAsync: refundMutateAsyncMock,
  }),
  useCashierEnsurePaymentPrintDocumentMutation: () => ({
    isPending: false,
    mutateAsync: ensurePrintDocumentMutateAsyncMock,
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
  aggregateCashierOrderItems: (items: Array<Record<string, unknown>> = []) => {
    const aggregated = new Map<string, Record<string, unknown>>();
    items.forEach((item) => {
      const statusGroup = item.status === 'cancelled' ? 'cancelled' : 'active';
      const key = [item.catalogItem, item.note ?? '', statusGroup, item.prepStationName ?? ''].join('::');
      const existing = aggregated.get(key);
      if (existing) {
        existing.quantity = Number(existing.quantity ?? 0) + Number(item.quantity ?? 0);
        existing.lineTotal = Number(existing.lineTotal ?? 0) + Number(item.lineTotal ?? 0);
      } else {
        aggregated.set(key, { ...item });
      }
    });
    return Array.from(aggregated.values());
  },
  groupCashierOrderItemsByStation: (items: Array<Record<string, unknown>> = []) => [['Issiq oshxona', items]],
  getCashierOrderNumberLabel: (order: { orderNumber: number }) => `ID ${order.orderNumber}`,
  getCashierOrderDisplayName: (order: { orderNumber: number; displayName?: string | null }) => {
    const displayName = order.displayName?.trim();
    if (!displayName) return `ID ${order.orderNumber}`;
    return /^\d+$/.test(displayName) ? `#${displayName}` : displayName;
  },
  isCashierFiscalIntegrationReady: (context: {
    availableCashDesks?: Array<{ fiscalProvider?: string }>;
    fiscalDeviceStatus?: { online?: boolean };
  }) => Boolean(context.availableCashDesks?.[0]?.fiscalProvider && context.fiscalDeviceStatus?.online),
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

vi.mock('modules/edge-printing', () => ({
  useEdgePrintMutation: () => ({ mutateAsync: edgePrintMutateAsyncMock, isPending: false }),
}));

describe('OpenChecksPageContent', () => {
  beforeEach(() => {
    cleanup();
    navigateMock.mockReset();
    openOrdersMock.mockReset();
    closedOrdersMock.mockReset();
    fiscalClosedOrdersMock.mockReset();
    updateDisplayNameMutateAsyncMock.mockReset();
    retryFiscalMutateMock.mockReset();
    closedRefetchMock.mockReset();
    fiscalClosedRefetchMock.mockReset();
    ensurePrintDocumentMutateAsyncMock.mockReset();
    ensurePrintDocumentMutateAsyncMock.mockResolvedValue({
      receipt: { id: 'receipt-materialized', printDocument: 'document-materialized' },
    });
    edgePrintMutateAsyncMock.mockClear();
    refundMutateAsyncMock.mockReset();
    fiscalDeviceOnlineMock = true;
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
    fiscalClosedOrdersMock.mockReturnValue([]);
  });

  it('does not show the go-to-menu action for open hall checks', () => {
    render(<OpenChecksPageContent />);

    expect(screen.queryByRole('button', { name: "Menyuga o'tish" })).toBeNull();
  });

  it('shows duplicate products as one quantity row in all three tabs', () => {
    const duplicateItems = [
      {
        id: 'item-1',
        catalogItem: 'cola',
        catalogItemName: 'Cola',
        quantity: 1,
        lineTotal: 12000,
        status: 'new',
        prepStationName: 'Bar',
      },
      {
        id: 'item-2',
        catalogItem: 'cola',
        catalogItemName: 'Cola',
        quantity: 1,
        lineTotal: 12000,
        status: 'cooking',
        prepStationName: 'Bar',
      },
    ];
    const order = {
      id: 'order-duplicates',
      orderNumber: 110,
      status: 'open',
      subtotal: 24000,
      serviceFee: 0,
      total: 24000,
      channel: 'hall',
      items: duplicateItems,
      guestCount: 1,
      openedByName: 'Ali',
      payments: [{ id: 'payment-duplicates', amount: 24000, status: 'succeeded', method: 'cash' }],
    };
    openOrdersState = [order];
    closedOrdersMock.mockReturnValue([{ ...order, status: 'closed' }]);
    fiscalClosedOrdersMock.mockReturnValue([{ ...order, status: 'closed' }]);

    render(<OpenChecksPageContent />);
    expect(screen.getAllByText('Cola (x2)')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: /Precheklar/ }));
    expect(screen.getAllByText('Cola (x2)')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: /Cheklar/ }));
    expect(screen.getAllByText('Cola (x2)')).toHaveLength(1);
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

    fireEvent.click(screen.getByRole('button', { name: /Precheklar/ }));

    expect(screen.queryByRole('button', { name: "Menyuga o'tish" })).toBeNull();
  });

  it('materializes and prints a canonical document for a historical closed check', async () => {
    openOrdersMock.mockReturnValue([]);
    closedOrdersMock.mockReturnValue([
      {
        id: 'order-6',
        orderNumber: 106,
        displayName: '55',
        status: 'closed',
        subtotal: 22000,
        serviceFee: 0,
        serviceFeePercent: 0,
        total: 22000,
        note: '',
        channel: 'takeaway',
        items: [
          {
            id: 'item-1',
            catalogItem: 'item-1',
            catalogItemName: 'Shaverma',
            quantity: 1,
            lineTotal: 22000,
            status: 'active',
          },
        ],
        tableSession: null,
        tableName: '',
        guestCount: 1,
        openedByName: 'Ali',
        cashierName: 'Adham',
        createdAt: '2026-04-18T09:00:00Z',
        closedAt: '2026-04-18T09:30:00Z',
        payments: [{ id: 'payment-6', amount: 22000, status: 'succeeded', method: 'cash' }],
        receipts: [],
        vatEnabled: true,
        vatPercent: 12,
        vatAmount: 2357,
      },
    ]);

    render(<OpenChecksPageContent />);
    fireEvent.click(screen.getByRole('button', { name: /Precheklar/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Prechekni qayta chiqarish' }));

    await waitFor(() => {
      expect(ensurePrintDocumentMutateAsyncMock).toHaveBeenCalledWith('payment-6');
      expect(edgePrintMutateAsyncMock).toHaveBeenCalledWith({ documentId: 'document-materialized' });
    });
  });

  it('reprints a fiscal receipt from fiscal checks', async () => {
    openOrdersMock.mockReturnValue([]);
    fiscalClosedOrdersMock.mockReturnValue([
      {
        id: 'order-7',
        orderNumber: 107,
        displayName: '',
        status: 'closed',
        subtotal: 30000,
        serviceFee: 0,
        serviceFeePercent: 0,
        total: 30000,
        note: '',
        channel: 'hall',
        items: [],
        tableSession: 'session-7',
        tableName: 'Stol 7',
        guestCount: 2,
        openedByName: 'Ali',
        cashierName: 'Adham',
        createdAt: '2026-04-18T09:00:00Z',
        closedAt: '2026-04-18T09:30:00Z',
        payments: [{ id: 'payment-7', amount: 30000, status: 'succeeded', method: 'cash' }],
        receipts: [{ id: 'receipt-7', kind: 'fiscal', status: 'sent', payload: { receiptNumber: 'F-7' } }],
      },
    ]);
    ensurePrintDocumentMutateAsyncMock.mockResolvedValue({
      receipt: { id: 'receipt-7', printDocument: 'document-7', payload: { receiptNumber: 'F-7' } },
    });

    render(<OpenChecksPageContent />);
    fireEvent.click(screen.getByRole('button', { name: /Cheklar/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Chekni qayta chiqarish' }));

    await waitFor(() => {
      expect(ensurePrintDocumentMutateAsyncMock).toHaveBeenCalledWith('payment-7');
      expect(edgePrintMutateAsyncMock).toHaveBeenCalledWith({ documentId: 'document-7' });
    });
  });

  it('disables fiscal actions in prechecks and checks when the fiscal integration is unavailable', async () => {
    fiscalDeviceOnlineMock = false;
    openOrdersMock.mockReturnValue([]);
    closedOrdersMock.mockReturnValue([
      {
        id: 'order-offline-precheck',
        orderNumber: 108,
        status: 'closed',
        subtotal: 20000,
        serviceFee: 0,
        total: 20000,
        channel: 'hall',
        items: [],
        guestCount: 1,
        openedByName: 'Ali',
        payments: [{ id: 'payment-offline-precheck', amount: 20000, status: 'succeeded', method: 'cash' }],
      },
    ]);
    fiscalClosedOrdersMock.mockReturnValue([
      {
        id: 'order-offline-fiscal',
        orderNumber: 109,
        status: 'closed',
        subtotal: 30000,
        serviceFee: 0,
        total: 30000,
        channel: 'hall',
        items: [],
        guestCount: 1,
        openedByName: 'Ali',
        payments: [{ id: 'payment-offline-fiscal', amount: 30000, status: 'succeeded', method: 'cash' }],
      },
    ]);

    render(<OpenChecksPageContent />);
    fireEvent.click(screen.getByRole('button', { name: /Precheklar/ }));

    const issueFiscalButton = screen.getByRole('button', { name: 'Chek chiqarish' }) as HTMLButtonElement;
    expect(issueFiscalButton.disabled).toBe(true);
    fireEvent.mouseOver(issueFiscalButton.parentElement as HTMLElement);
    expect(
      await screen.findByText('Fiscal integratsiya ishlamayapti. Chek chiqarish uchun ulanishni tekshiring.'),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Cheklar/ }));
    const reprintFiscalButton = screen.getByRole('button', { name: 'Chekni qayta chiqarish' }) as HTMLButtonElement;
    expect(reprintFiscalButton.disabled).toBe(true);
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
    closedOrdersMock.mockReturnValue([
      {
        id: 'order-4',
        orderNumber: 104,
        displayName: '5',
        status: 'closed',
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
    fireEvent.click(screen.getByRole('button', { name: /Precheklar/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Chek chiqarish' }));

    expect(await screen.findByText('Chek tayyor')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Chekni chiqarish' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Yakunlash' }));
    expect(await screen.findByText('Chek kerakmi?')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Ha, chiqarish' }));

    await waitFor(() => {
      expect(edgePrintMutateAsyncMock).toHaveBeenCalledWith({ documentId: 'document-2' });
      expect(closedRefetchMock).toHaveBeenCalled();
      expect(fiscalClosedRefetchMock).toHaveBeenCalled();
    });
  });

  it('can finish the retry receipt dialog without printing', async () => {
    openOrdersMock.mockReturnValue([]);
    closedOrdersMock.mockReturnValue([
      {
        id: 'order-5',
        orderNumber: 105,
        status: 'closed',
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
    fireEvent.click(screen.getByRole('button', { name: /Precheklar/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Chek chiqarish' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Yakunlash' }));
    fireEvent.click(await screen.findByRole('button', { name: "Yo'q" }));

    expect(edgePrintMutateAsyncMock).not.toHaveBeenCalled();
    expect(closedRefetchMock).toHaveBeenCalled();
    expect(fiscalClosedRefetchMock).toHaveBeenCalled();
  });
});
