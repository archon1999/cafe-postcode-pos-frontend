// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CashierShiftPage } from './CashierShiftPage';

const navigateMock = vi.fn();
const reportMutateAsyncMock = vi.fn();
const requestEdgePrintDocumentsMock = vi.hoisted(() => vi.fn());
const shiftContextState = vi.hoisted(() => ({
  fiscalProvider: 'fiscal-drive-service',
  reportPending: false,
}));

vi.mock('react-router', () => ({
  Navigate: () => null,
  useNavigate: () => navigateMock,
  useSearchParams: () => [new URLSearchParams()],
}));

vi.mock('modules/auth', () => ({
  canCreateCashExpense: () => false,
  canManageCashShift: () => true,
  canViewCashShift: () => true,
  getPosHomePath: () => '/cashier',
  isCashierBuilderMode: () => false,
  usePosSession: () => ({
    session: { user: { id: 'manager-1' } },
    locale: 'uz',
    setLocale: vi.fn(),
    setSession: vi.fn(),
    themeColor: 'default',
    setThemeColor: vi.fn(),
    themeMode: 'light',
    setThemeMode: vi.fn(),
  }),
}));

vi.mock('modules/cashier/application', () => ({
  useCashierContextQuery: () => ({
    data: {
      currentShift: null,
      activeShifts: [
        {
          id: 'shift-1',
          status: 'open',
          cashDesk: 'desk-1',
          cashDeskName: 'Kassa',
          cashierName: 'Manager',
          openedAt: '2026-07-13T08:00:00Z',
          openingCashAmount: 0,
          actualClosingCashAmount: 0,
          expectedClosingCashAmount: 50000,
          cashDifferenceAmount: 0,
          cashTotal: 50000,
          cardTotal: 0,
          cashPrecheckTotal: 18000,
          cashReceiptTotal: 32000,
          cardPrecheckTotal: 0,
          cardReceiptTotal: 0,
          qrTotal: 0,
          refundTotal: 0,
          expenseTotal: 0,
          saleCount: 1,
          refundCount: 0,
          totalSaleAmount: 50000,
          cashRefundTotal: 0,
          cardRefundTotal: 0,
          qrRefundTotal: 0,
          vatSaleTotal: 0,
          vatRefundTotal: 0,
          firstReceipt: '41',
          lastReceipt: '41',
          receiptCount: 1,
          reprintCount: 0,
        },
      ],
      availableCashDesks: [{ id: 'desk-1', name: 'Kassa', fiscalProvider: shiftContextState.fiscalProvider }],
      availableCashiers: [],
      fiscalShiftOpen: true,
    },
    isLoading: false,
    refetch: vi.fn(),
  }),
  useOpenCashierShiftMutation: () => ({ isPending: false, mutate: vi.fn() }),
  useCloseCashierShiftMutation: () => ({ isPending: false, mutate: vi.fn() }),
  usePrintCashierShiftReportMutation: () => ({
    isPending: shiftContextState.reportPending,
    mutateAsync: reportMutateAsyncMock,
  }),
}));

vi.mock('modules/edge-printing/application', () => ({
  requestEdgePrintDocuments: requestEdgePrintDocumentsMock,
}));

vi.mock('shared/layout/PosPageFrame', () => ({
  PosPageFrame: ({ header, children }: { header: ReactNode; children: ReactNode }) => (
    <div>
      {header}
      {children}
    </div>
  ),
}));

vi.mock('shared/ui/pos-primitives', () => ({
  PosIconAction: () => <button type="button" />,
  PosSettingsMenu: () => null,
}));

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

describe('CashierShiftPage report printing', () => {
  beforeEach(() => {
    cleanup();
    reportMutateAsyncMock.mockReset();
    requestEdgePrintDocumentsMock.mockReset();
    shiftContextState.fiscalProvider = 'fiscal-drive-service';
    shiftContextState.reportPending = false;
    reportMutateAsyncMock.mockResolvedValue({ printDocuments: ['general-1', 'fiscal-1'] });
  });

  it('prints general and fiscal reports in backend order', async () => {
    render(<CashierShiftPage />);

    expect(screen.queryByText("Boshlang'ich naqd")).toBeNull();
    expect(screen.getByText('Kutilgan naqd')).toBeTruthy();
    expect(screen.getByText('Xarajatlar')).toBeTruthy();
    expect(screen.queryByText('QR')).toBeNull();
    expect(screen.queryByLabelText('Izoh')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ishni davom ettirish' })).toBeNull();
    expect(screen.getByText('Sotuv')).toBeTruthy();
    expect(screen.getByText('Naqd — prechek')).toBeTruthy();
    expect(screen.getByText('Naqd — chek')).toBeTruthy();
    expect(screen.getByText('Karta — prechek')).toBeTruthy();
    expect(screen.getByText('Karta — chek')).toBeTruthy();
    expect(screen.getByText('Qaytarish')).toBeTruthy();
    expect(screen.getByText('Birinchi chek')).toBeTruthy();
    expect(screen.getByText('Oxirgi chek')).toBeTruthy();
    expect(screen.getAllByText(/50.000 so'm/)).toHaveLength(2);
    expect(screen.getByText(/18\s000 so'm/)).toBeTruthy();
    expect(screen.getByText(/32\s000 so'm/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Chek chiqarish' }));

    await waitFor(() => expect(requestEdgePrintDocumentsMock).toHaveBeenCalledTimes(1));
    expect(reportMutateAsyncMock).toHaveBeenCalledWith({ cashShiftId: 'shift-1' });
    expect(requestEdgePrintDocumentsMock).toHaveBeenCalledWith(['general-1', 'fiscal-1']);
  });

  it('keeps the report button enabled while a report request is pending', () => {
    shiftContextState.reportPending = true;

    render(<CashierShiftPage />);

    const button = screen.getByRole('button', { name: 'Jarayon...' }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
  });

  it('keeps the report button enabled when fiscal integration is unavailable', () => {
    shiftContextState.fiscalProvider = '';

    render(<CashierShiftPage />);

    const button = screen.getByRole('button', { name: 'Chek chiqarish' }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
  });
});
