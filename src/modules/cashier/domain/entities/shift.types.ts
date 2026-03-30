export type BranchFiscalProfile = {
  legalName: string;
  taxNumber: string;
  vatEnabled: boolean;
};

export type CashierContextCashDesk = {
  id: string;
  name: string;
  location: string;
  enabledPaymentMethods: Array<'cash' | 'card' | 'qr'>;
  fiscalProvider: string;
  receiptPrinterEnabled: boolean;
  terminalId: string;
  externalCashboxId: string;
  isActive: boolean;
};

export type CashShiftSummary = {
  id: string;
  status: 'open' | 'closed';
  cashDesk?: string | null;
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
};

export type CashierContext = {
  branchFiscalProfile: BranchFiscalProfile;
  availableCashDesks: CashierContextCashDesk[];
  currentShift: CashShiftSummary | null;
};
