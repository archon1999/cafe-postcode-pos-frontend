// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PaymentPageContent } from './PaymentPageContent';

const navigateMock = vi.fn();
const canAddCashierPaymentOrderItemsMock = vi.fn();
const canAccessWaiterTablesMock = vi.fn();
const canRemoveCashierPaymentOrderItemsMock = vi.fn();
const addPaymentOrderItemMutateAsyncMock = vi.fn();
const removePaymentOrderItemMutateAsyncMock = vi.fn();
const updateDisplayNameMutateAsyncMock = vi.fn();
const paymentMutateAsyncMock = vi.fn();
const printReceiptWithFallbackMock = vi.fn(() => Promise.resolve(true));
const clipboardWriteTextMock = vi.fn();
let orderChannelMock = 'takeaway';
let enabledPaymentMethodsMock: Array<'cash' | 'card' | 'mixed'> = ['cash'];
let paymentMutationStateMock = {
  isPending: false,
  isError: false,
  isSuccess: false,
  error: null as unknown,
};

vi.mock('react-router', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('@iconify/react', () => ({
  Icon: () => <span />,
}));

vi.mock('modules/auth', () => ({
  canAddCashierPaymentOrderItems: (...args: unknown[]) => canAddCashierPaymentOrderItemsMock(...args),
  canAccessTakeawayBuilder: () => false,
  canAccessWaiterTables: (...args: unknown[]) => canAccessWaiterTablesMock(...args),
  canManageCashierPayments: () => true,
  canRemoveCashierPaymentOrderItems: (...args: unknown[]) => canRemoveCashierPaymentOrderItemsMock(...args),
  canSkipFiscalReceipts: () => false,
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
  useRemoveCashierPaymentOrderItemMutation: () => ({
    isPending: false,
    mutateAsync: removePaymentOrderItemMutateAsyncMock,
  }),
  useCashierContextQuery: () => ({
    data: {
      availableCashDesks: [
        {
          id: 'desk-1',
          name: 'Main cash desk',
          enabledPaymentMethods: enabledPaymentMethodsMock,
          printerIntegration: 'printer-1',
        },
      ],
      currentShift: { cashDesk: 'desk-1' },
    },
  }),
  useCashierPaymentMutation: () => ({
    ...paymentMutationStateMock,
    mutateAsync: paymentMutateAsyncMock,
  }),
  useCashierOrderScanMutation: () => ({
    isPending: false,
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
      channel: orderChannelMock,
      subtotal: 30000,
      serviceFee: 0,
      vatEnabled: true,
      vatPercent: 12,
      vatAmount: 3214,
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
  getCashierOrderNumberLabel: (order: { orderNumber: number }) => `ID ${order.orderNumber}`,
  getCashierOrderDisplayName: (order: { orderNumber: number; displayName?: string | null }) => {
    const displayName = order.displayName?.trim();
    if (!displayName) return `ID ${order.orderNumber}`;
    return /^\d+$/.test(displayName) ? `#${displayName}` : displayName;
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

vi.mock('shared/ui/pos-primitives', () => ({
  PosIconAction: ({ onClick }: { onClick?: () => void }) => <button onClick={onClick}>icon</button>,
  PosOrderChannelSegment: () => <div>segment</div>,
  PosSettingsMenu: () => null,
}));

vi.mock('shared/printing/browserReceipt', () => ({
  printReceiptWithFallback: (...args: unknown[]) => printReceiptWithFallbackMock(...args),
}));

describe('PaymentPageContent', () => {
  beforeEach(() => {
    cleanup();
    navigateMock.mockReset();
    canAddCashierPaymentOrderItemsMock.mockReset();
    canAccessWaiterTablesMock.mockReset();
    canRemoveCashierPaymentOrderItemsMock.mockReset();
    addPaymentOrderItemMutateAsyncMock.mockReset();
    removePaymentOrderItemMutateAsyncMock.mockReset();
    updateDisplayNameMutateAsyncMock.mockReset();
    paymentMutateAsyncMock.mockReset();
    printReceiptWithFallbackMock.mockClear();
    clipboardWriteTextMock.mockReset();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: clipboardWriteTextMock },
    });
    paymentMutationStateMock = {
      isPending: false,
      isError: false,
      isSuccess: false,
      error: null,
    };
    orderChannelMock = 'takeaway';
    enabledPaymentMethodsMock = ['cash'];
    canAddCashierPaymentOrderItemsMock.mockReturnValue(true);
    canAccessWaiterTablesMock.mockReturnValue(false);
    canRemoveCashierPaymentOrderItemsMock.mockReturnValue(false);
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

  it('shows the remove-one action only for takeaway orders with the separate permission', () => {
    canRemoveCashierPaymentOrderItemsMock.mockReturnValue(true);
    render(<PaymentPageContent orderId="order-1" />);

    expect(screen.getByRole('button', { name: 'Bittaga kamaytirish' })).toBeTruthy();

    cleanup();
    canRemoveCashierPaymentOrderItemsMock.mockReturnValue(false);
    render(<PaymentPageContent orderId="order-1" />);

    expect(screen.queryByRole('button', { name: 'Bittaga kamaytirish' })).toBeNull();
  });

  it('removes one representative item from the payment detail list', () => {
    canRemoveCashierPaymentOrderItemsMock.mockReturnValue(true);
    render(<PaymentPageContent orderId="order-1" />);

    fireEvent.click(screen.getByRole('button', { name: 'Bittaga kamaytirish' }));

    expect(removePaymentOrderItemMutateAsyncMock).toHaveBeenCalledWith('item-1');
  });

  it('shows plus for hall orders with table manage access and hides minus', () => {
    orderChannelMock = 'hall';
    canAddCashierPaymentOrderItemsMock.mockReturnValue(false);
    canAccessWaiterTablesMock.mockReturnValue(true);
    canRemoveCashierPaymentOrderItemsMock.mockReturnValue(true);

    render(<PaymentPageContent orderId="order-1" />);

    expect(screen.getByRole('button', { name: "Yana qo'shish" })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Bittaga kamaytirish' })).toBeNull();
  });

  it('treats delivery payment orders like builder orders for item edits', () => {
    orderChannelMock = 'delivery';
    canAddCashierPaymentOrderItemsMock.mockReturnValue(true);
    canAccessWaiterTablesMock.mockReturnValue(false);
    canRemoveCashierPaymentOrderItemsMock.mockReturnValue(true);

    render(<PaymentPageContent orderId="order-1" />);

    expect(screen.getByText('Yetkazib berish')).toBeTruthy();
    expect(screen.getByRole('button', { name: "Yana qo'shish" })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Bittaga kamaytirish' })).toBeTruthy();
    expect(canAccessWaiterTablesMock).not.toHaveBeenCalled();
  });

  it('renders the custom order name as the primary title', () => {
    render(<PaymentPageContent orderId="order-1" />);

    expect(screen.getByText('VIP mijoz')).toBeTruthy();
    expect(screen.getByText('Buyurtma: ID 101')).toBeTruthy();
  });

  it('shows included VAT in the payment totals without changing the grand total', () => {
    render(<PaymentPageContent orderId="order-1" />);

    expect(screen.getByText('QQS (12%):')).toBeTruthy();
    expect(screen.getByText(/3\s214 so'm/)).toBeTruthy();
    expect(screen.getAllByText(/30\s000 so'm/).length).toBeGreaterThan(0);
  });

  it('shows cash and card payment methods without mixed or QR', () => {
    enabledPaymentMethodsMock = ['cash', 'card', 'mixed'];

    render(<PaymentPageContent orderId="order-1" />);

    expect(screen.getByRole('button', { name: 'Naqd' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Karta' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Aralash' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'QR' })).toBeNull();
  });

  it('submits split payment parts sequentially with the selected fiscal intent', async () => {
    paymentMutateAsyncMock
      .mockResolvedValueOnce({
        order: {
          orderNumber: 101,
          status: 'submitted',
          items: [],
          subtotal: 30000,
          serviceFee: 0,
          total: 30000,
          note: '',
        },
        payment: {
          method: 'cash',
          amount: 10000,
          paidAt: '2026-04-18T10:00:00Z',
        },
        receipt: null,
      })
      .mockResolvedValueOnce({
        order: {
          orderNumber: 101,
          status: 'closed',
          items: [],
          subtotal: 30000,
          serviceFee: 0,
          total: 30000,
          note: '',
          payments: [
            { id: 'payment-1', method: 'cash', status: 'succeeded', amount: 10000, cashAmount: 10000 },
            { id: 'payment-2', method: 'cash', status: 'succeeded', amount: 20000, cashAmount: 20000 },
          ],
        },
        payment: {
          method: 'cash',
          amount: 20000,
          paidAt: '2026-04-18T10:01:00Z',
          externalRef: 'R-3',
        },
        receipt: { id: 'receipt-3', payload: { receiptNumber: 'R-3' } },
      });

    render(<PaymentPageContent orderId="order-1" />);
    fireEvent.click(screen.getByRole('button', { name: "Bo'lak qo'shish" }));
    fireEvent.change(screen.getByLabelText("To'lov 1"), { target: { value: '10000' } });
    fireEvent.change(screen.getByLabelText("To'lov 2"), { target: { value: '20000' } });
    fireEvent.click(screen.getByRole('button', { name: /Fiscal bilan/ }));

    await waitFor(() => {
      expect(paymentMutateAsyncMock).toHaveBeenNthCalledWith(1, {
        method: 'cash',
        amount: 10000,
        registerFiscal: true,
      });
      expect(paymentMutateAsyncMock).toHaveBeenNthCalledWith(2, {
        method: 'cash',
        amount: 20000,
        registerFiscal: true,
      });
    });
    expect(await screen.findByText('Chek tayyor')).toBeTruthy();
  });

  it('uses one split editor for cash and card parts', async () => {
    enabledPaymentMethodsMock = ['cash', 'card', 'mixed'];
    paymentMutateAsyncMock
      .mockResolvedValueOnce({
        order: {
          orderNumber: 101,
          status: 'submitted',
          items: [],
          subtotal: 30000,
          serviceFee: 0,
          total: 30000,
          note: '',
        },
        payment: {
          method: 'cash',
          amount: 15000,
          paidAt: '2026-04-18T10:00:00Z',
        },
        receipt: null,
      })
      .mockResolvedValueOnce({
        order: {
          orderNumber: 101,
          status: 'closed',
          items: [],
          subtotal: 30000,
          serviceFee: 0,
          total: 30000,
          note: '',
        },
        payment: {
          method: 'card',
          amount: 15000,
          paidAt: '2026-04-18T10:01:00Z',
          externalRef: 'R-4',
        },
        receipt: { id: 'receipt-4', payload: { receiptNumber: 'R-4' } },
      });

    render(<PaymentPageContent orderId="order-1" />);
    fireEvent.click(screen.getByRole('button', { name: "Bo'lak qo'shish" }));

    expect(screen.getByText("To'lov bo'laklari")).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Naqd' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Karta' })).toBeNull();
    expect((screen.getByLabelText("To'lov 1") as HTMLInputElement).value).toBe('15000');
    expect((screen.getByLabelText("To'lov 2") as HTMLInputElement).value).toBe('15000');
    const paymentMethodSelects = screen.getAllByLabelText("To'lov turi");
    fireEvent.mouseDown(paymentMethodSelects[1]);
    fireEvent.click(await screen.findByRole('option', { name: 'Karta' }));

    fireEvent.click(screen.getByRole('button', { name: /Fiscal bilan/ }));

    await waitFor(() => {
      expect(paymentMutateAsyncMock).toHaveBeenNthCalledWith(1, {
        method: 'cash',
        amount: 15000,
        registerFiscal: true,
      });
      expect(paymentMutateAsyncMock).toHaveBeenNthCalledWith(2, {
        method: 'card',
        amount: 15000,
        registerFiscal: true,
      });
    });
  });

  it('keeps paid split parts visible and retries only the failed card part', async () => {
    enabledPaymentMethodsMock = ['cash', 'card'];
    paymentMutateAsyncMock
      .mockResolvedValueOnce({
        order: {
          orderNumber: 101,
          status: 'submitted',
          items: [],
          subtotal: 30000,
          serviceFee: 0,
          total: 30000,
          note: '',
        },
        payment: {
          method: 'cash',
          amount: 15000,
          paidAt: '2026-04-18T10:00:00Z',
        },
        receipt: null,
      })
      .mockRejectedValueOnce({
        response: {
          data: {
            detail: 'Canceled',
            payment: {
              provider_payload: {
                provider: 'marta-softpos',
                status: 'CANCELED',
                message: 'Canceled',
              },
            },
          },
        },
      })
      .mockResolvedValueOnce({
        order: {
          orderNumber: 101,
          status: 'closed',
          items: [],
          subtotal: 30000,
          serviceFee: 0,
          total: 30000,
          note: '',
        },
        payment: {
          method: 'card',
          amount: 15000,
          paidAt: '2026-04-18T10:01:00Z',
          externalRef: 'R-5',
        },
        receipt: { id: 'receipt-5', payload: { receiptNumber: 'R-5' } },
      });

    render(<PaymentPageContent orderId="order-1" />);
    fireEvent.click(screen.getByRole('button', { name: "Bo'lak qo'shish" }));
    const paymentMethodSelects = screen.getAllByLabelText("To'lov turi");
    fireEvent.mouseDown(paymentMethodSelects[1]);
    fireEvent.click(await screen.findByRole('option', { name: 'Karta' }));

    fireEvent.click(screen.getByRole('button', { name: /Fiscal bilan/ }));

    await waitFor(() => {
      expect(paymentMutateAsyncMock).toHaveBeenCalledTimes(2);
    });
    expect(screen.getByText("To'langan summa")).toBeTruthy();
    expect((screen.getByLabelText("To'lov 1") as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText("To'lov 2") as HTMLInputElement).disabled).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Fiscalga qayta yuborish' }));

    await waitFor(() => {
      expect(paymentMutateAsyncMock).toHaveBeenNthCalledWith(3, {
        method: 'card',
        amount: 15000,
        registerFiscal: true,
      });
    });
  });

  it('rejects zero split part amounts without submitting', () => {
    enabledPaymentMethodsMock = ['cash', 'card'];

    render(<PaymentPageContent orderId="order-1" />);
    fireEvent.click(screen.getByRole('button', { name: "Bo'lak qo'shish" }));
    fireEvent.change(screen.getByLabelText("To'lov 1"), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText("To'lov 2"), { target: { value: '30000' } });

    expect((screen.getByRole('button', { name: /Fiscal bilan/ }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /Fiscal bilan/ }));

    expect(paymentMutateAsyncMock).not.toHaveBeenCalled();
  });

  it('asks whether to print after finishing the payment receipt dialog', async () => {
    paymentMutateAsyncMock.mockResolvedValueOnce({
      order: {
        orderNumber: 101,
        displayName: '5',
        items: [],
        subtotal: 30000,
        serviceFee: 0,
        total: 30000,
        note: '',
      },
      payment: {
        method: 'cash',
        amount: 30000,
        paidAt: '2026-04-18T10:00:00Z',
        externalRef: 'R-1',
      },
      receipt: { id: 'receipt-1', payload: { receiptNumber: 'R-1' } },
    });

    render(<PaymentPageContent orderId="order-1" />);
    fireEvent.click(screen.getByRole('button', { name: /Fiscal bilan/ }));

    expect(await screen.findByText('Chek tayyor')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Chekni chiqarish' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Yakunlash' }));
    expect(await screen.findByText('Chek kerakmi?')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Ha, chiqarish' }));

    await waitFor(() => {
      expect(printReceiptWithFallbackMock).toHaveBeenCalledWith(
        expect.objectContaining({
          receiptNumber: 'R-1',
          order_label: '#5',
          order_number: '#5',
          channel_label: 'Zalda',
        }),
        { preferLocalAgent: true, receiptId: 'receipt-1' },
      );
      expect(navigateMock).toHaveBeenCalledWith('/cashier/open-checks', { replace: true });
    });
  });

  it('prints plain payment fallback receipt without VAT or ID-prefixed order number', async () => {
    paymentMutateAsyncMock.mockResolvedValueOnce({
      order: {
        orderNumber: 101,
        displayName: 'VIP mijoz',
        status: 'closed',
        items: [],
        subtotal: 30000,
        serviceFee: 0,
        vatEnabled: true,
        vatPercent: 12,
        vatAmount: 3214,
        total: 30000,
        note: '',
      },
      payment: {
        method: 'cash',
        amount: 30000,
        paidAt: '2026-04-18T10:00:00Z',
      },
      receipt: null,
    });

    render(<PaymentPageContent orderId="order-1" />);
    fireEvent.click(screen.getByRole('button', { name: /Fiscal bilan/ }));
    expect(await screen.findByText('Chek tayyor')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Yakunlash' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Ha, chiqarish' }));

    await waitFor(() => {
      expect(printReceiptWithFallbackMock).toHaveBeenCalledWith(
        expect.objectContaining({
          snapshot: expect.objectContaining({
            order_label: '101',
            orderLabel: '101',
            order_number: '101',
            orderNumber: '101',
            vat_enabled: false,
            vat_percent: 0,
            vat_amount: 0,
          }),
        }),
        { preferLocalAgent: true, receiptId: undefined },
      );
    });
  });

  it('can finish the payment receipt dialog without printing', async () => {
    paymentMutateAsyncMock.mockResolvedValueOnce({
      order: {
        orderNumber: 101,
        items: [],
        subtotal: 30000,
        serviceFee: 0,
        total: 30000,
        note: '',
      },
      payment: {
        method: 'cash',
        amount: 30000,
        paidAt: '2026-04-18T10:00:00Z',
        externalRef: 'R-1',
      },
      receipt: { id: 'receipt-1', payload: { receiptNumber: 'R-1' } },
    });

    render(<PaymentPageContent orderId="order-1" />);
    fireEvent.click(screen.getByRole('button', { name: /Fiscal bilan/ }));

    fireEvent.click(await screen.findByRole('button', { name: 'Yakunlash' }));
    fireEvent.click(await screen.findByRole('button', { name: "Yo'q" }));

    expect(printReceiptWithFallbackMock).not.toHaveBeenCalled();
    expect(navigateMock).toHaveBeenCalledWith('/cashier/open-checks', { replace: true });
  });

  it('shows backend payment detail when payment mutation fails', async () => {
    paymentMutationStateMock = {
      isPending: false,
      isError: true,
      isSuccess: false,
      error: {
        response: {
          data: {
            detail: 'SoftPOS is not ready. Open standby screen and keep the app in foreground',
          },
        },
      },
    };

    render(<PaymentPageContent orderId="order-1" />);

    expect(
      await screen.findByText('SoftPOS is not ready. Open standby screen and keep the app in foreground'),
    ).toBeTruthy();
  });

  it('shows copyable MARTA request and response JSON for non-2xx terminal errors', async () => {
    enabledPaymentMethodsMock = ['cash', 'card'];
    paymentMutateAsyncMock.mockRejectedValueOnce({
      response: {
        data: {
          detail: 'Terminal error',
          payment: {
            providerPayload: {
              provider: 'marta-softpos',
              status: 'ERROR',
              requestId: 'request-500',
              debug: {
                transaction: {
                  request: {
                    method: 'GET',
                    path: '/transaction',
                    params: { type: 'PURCHASE', amount: 1000000, pid: 123, tin: '307678400' },
                  },
                  response: {
                    httpStatus: 500,
                    body: { ok: false, status: 'ERROR', message: 'Terminal error' },
                  },
                },
              },
            },
          },
        },
      },
    });

    render(<PaymentPageContent orderId="order-1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Karta' }));
    fireEvent.click(screen.getByRole('button', { name: /Fiscal bilan/ }));

    expect(await screen.findByText('MARTA request/response')).toBeTruthy();
    expect(screen.getByText(/"httpStatus": 500/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Copy JSON' }));

    expect(clipboardWriteTextMock).toHaveBeenCalledWith(expect.stringContaining('"path": "/transaction"'));
  });
});
