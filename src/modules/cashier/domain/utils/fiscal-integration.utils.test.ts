import { describe, expect, it } from 'vitest';

import type { CashierContext } from '../entities';

import { isCashierFiscalIntegrationReady } from './fiscal-integration.utils';

function context(overrides?: Partial<CashierContext>): CashierContext {
  return {
    branchFiscalProfile: { legalName: '', taxNumber: '', vatEnabled: false },
    availableCashDesks: [
      {
        id: 'desk-1',
        name: 'Main',
        location: '',
        enabledPaymentMethods: ['cash'],
        fiscalProvider: 'fiscal-drive-service',
        receiptPrinterEnabled: true,
        terminalId: 'terminal-1',
        externalCashboxId: '',
        isActive: true,
      },
    ],
    availableCashiers: [],
    currentShift: {
      id: 'shift-1',
      status: 'open',
      cashDesk: 'desk-1',
      openedAt: '2026-07-21T10:00:00Z',
      openingCashAmount: 0,
      actualClosingCashAmount: 0,
      expectedClosingCashAmount: 0,
      cashDifferenceAmount: 0,
      cashTotal: 0,
      cardTotal: 0,
      qrTotal: 0,
      refundTotal: 0,
      receiptCount: 0,
      reprintCount: 0,
    },
    activeShifts: [],
    fiscalShiftOpen: true,
    fiscalDeviceStatus: {
      online: true,
      provider: 'fiscal-drive-service',
      terminalId: 'terminal-1',
      detail: '',
      checkedAt: '2026-07-21T10:00:00Z',
    },
    ...overrides,
  };
}

describe('isCashierFiscalIntegrationReady', () => {
  it('returns true only when the active cash desk has an online fiscal integration', () => {
    expect(isCashierFiscalIntegrationReady(context())).toBe(true);
    expect(
      isCashierFiscalIntegrationReady(
        context({
          fiscalDeviceStatus: {
            online: false,
            provider: 'fiscal-drive-service',
            terminalId: 'terminal-1',
            detail: 'Offline',
            checkedAt: '2026-07-21T10:00:00Z',
          },
        }),
      ),
    ).toBe(false);
  });

  it('returns false when the active cash desk has no fiscal provider', () => {
    const withoutProvider = context();
    withoutProvider.availableCashDesks[0] = {
      ...withoutProvider.availableCashDesks[0],
      fiscalProvider: '',
    };

    expect(isCashierFiscalIntegrationReady(withoutProvider)).toBe(false);
  });
});
