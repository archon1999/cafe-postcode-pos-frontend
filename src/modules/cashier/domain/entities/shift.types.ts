export type BranchFiscalProfile = {
  legalName: string;
  taxNumber: string;
  vatEnabled: boolean;
};

export type CashierContextCashDesk = {
  id: string;
  name: string;
  location: string;
  enabledPaymentMethods: Array<'cash' | 'card' | 'mixed'>;
  paymentIntegration?: string | null;
  printerIntegration?: string | null;
  printerIntegrationName?: string | null;
  printerIntegrationPrinterName?: string | null;
  fiscalProvider: string;
  receiptPrinterEnabled: boolean;
  terminalId: string;
  externalCashboxId: string;
  isActive: boolean;
};

export type CashierContextCashier = {
  id: string;
  fullName: string;
  username: string;
};

export type CashShiftSummary = {
  id: string;
  status: 'open' | 'closed';
  cashDesk?: string | null;
  cashier?: string | null;
  openedBy?: string | null;
  openedAt: string;
  closedAt?: string | null;
  openingCashAmount: number;
  actualClosingCashAmount: number;
  expectedClosingCashAmount: number;
  cashDifferenceAmount: number;
  cashTotal: number;
  cardTotal: number;
  qrTotal: number;
  refundTotal: number;
  receiptCount: number;
  reprintCount: number;
  cashDeskName?: string | null;
  cashierName?: string | null;
  openedByName?: string | null;
};

export type CashierContext = {
  branchFiscalProfile: BranchFiscalProfile;
  availableCashDesks: CashierContextCashDesk[];
  availableCashiers: CashierContextCashier[];
  currentShift: CashShiftSummary | null;
  activeShifts: CashShiftSummary[];
  fiscalShiftOpen: boolean;
};

export type CashierShiftCloseResponse = CashierContext & {
  report?: Record<string, unknown>;
  fiscalShift?: Record<string, unknown>;
  fiscal_shift?: Record<string, unknown>;
};
