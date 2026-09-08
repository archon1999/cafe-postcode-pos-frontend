// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { CashierShiftCloseResponse } from 'modules/cashier/domain';

import { CashierShiftReportDialog } from './CashierShiftReportDialog';

const closed: CashierShiftCloseResponse = {
  branchFiscalProfile: { legalName: '', taxNumber: '', vatEnabled: false },
  availableCashDesks: [],
  availableCashiers: [],
  expenseCategories: [],
  expenseRecipients: [],
  currentShift: null,
  activeShifts: [],
  fiscalShiftOpen: false,
  closedShift: {
    id: 'shift',
    status: 'closed',
    openedAt: '2026-09-08T03:00:00Z',
    openingCashAmount: 0,
    actualClosingCashAmount: 10000,
    expectedClosingCashAmount: 10000,
    cashDifferenceAmount: 0,
    cashTotal: 10000,
    cardTotal: 0,
    qrTotal: 0,
    refundTotal: 0,
    expenseTotal: 0,
    receiptCount: 1,
    reprintCount: 0,
    soldItems: [{ catalogItemId: 'item', name: 'Osh QA', quantity: 1.25, saleUnit: 'kg', revenue: 10000 }],
  },
};

describe('closed shift report', () => {
  afterEach(cleanup);

  it('preserves the report details alongside sold products', () => {
    render(
      <CashierShiftReportDialog
        fullScreen={false}
        locale="uz"
        onClose={() => {}}
        report={{
          ...closed,
          report: {
            posReport: { TerminalID: 'TERM-QA', CloseTime: '08.09.2026 12:00:00', OrdersCount: 1, PaymentsCount: 2 },
          },
        }}
      />,
    );
    expect(screen.getByText('TERM-QA')).toBeTruthy();
    expect(screen.getByText('08.09.2026 12:00:00')).toBeTruthy();
    expect(screen.getByText('1 / 2')).toBeTruthy();
    expect(screen.getByText('Osh QA')).toBeTruthy();
  });

  it('shows totals and products for the offline close response without a report', () => {
    render(<CashierShiftReportDialog fullScreen={false} locale="uz" onClose={() => {}} report={closed} />);
    expect(screen.getByText('Osh QA')).toBeTruthy();
    expect(screen.getByText('Kutilgan naqd')).toBeTruthy();
  });
});
