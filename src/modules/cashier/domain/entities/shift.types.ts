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
  printerIntegrationConnectionType?: 'system_printer' | 'socket' | string | null;
  printerIntegrationHost?: string | null;
  printerIntegrationPort?: number | string | null;
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

export type ExpenseCategory = {
  id: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
};

export type CashExpense = {
  id: string;
  cashShiftId: string;
  cashDesk: string;
  cashDeskName: string;
  category: string;
  categoryName: string;
  amount: number;
  comment: string;
  recipient?: string | null;
  recipientName: string;
  createdBy: string;
  createdByName: string;
  status: 'posted' | 'voided';
  occurredAt: string;
  voidedAt?: string | null;
  voidReason: string;
};

export type CashShiftSummary = {
  id: string;
  status: 'open' | 'closing' | 'closed_local' | 'closed-local' | 'closed';
  closeState?: 'open' | 'draining' | 'fiscal_closing' | 'fiscal_unknown' | 'closed_local' | 'closed';
  syncState?: 'pending' | 'acknowledged' | 'action_required';
  closeBlockers?: Array<{ code: string; detail: string }>;
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
  cashPrecheckTotal?: number;
  cashReceiptTotal?: number;
  cardPrecheckTotal?: number;
  cardReceiptTotal?: number;
  qrTotal: number;
  refundTotal: number;
  expenseTotal: number;
  saleCount?: number;
  refundCount?: number;
  totalSaleAmount?: number;
  cashRefundTotal?: number;
  cardRefundTotal?: number;
  qrRefundTotal?: number;
  vatSaleTotal?: number;
  vatRefundTotal?: number;
  firstReceipt?: string;
  lastReceipt?: string;
  receiptCount: number;
  reprintCount: number;
  cashDeskName?: string | null;
  cashierName?: string | null;
  openedByName?: string | null;
};

export type FiscalDeviceStatus = {
  online: boolean;
  provider: string;
  terminalId: string;
  detail: string;
  checkedAt: string;
};

export type CashierContext = {
  pendingClosedShifts?: CashShiftSummary[];
  branchFiscalProfile: BranchFiscalProfile;
  availableCashDesks: CashierContextCashDesk[];
  availableCashiers: CashierContextCashier[];
  expenseCategories: ExpenseCategory[];
  expenseRecipients: CashierContextCashier[];
  currentShift: CashShiftSummary | null;
  activeShifts: CashShiftSummary[];
  fiscalShiftOpen: boolean;
  fiscalDeviceStatus?: FiscalDeviceStatus;
};

export type CashierShiftCloseResponse = CashierContext & {
  closedShift?: CashShiftSummary;
  closeState?: CashShiftSummary['closeState'];
  syncState?: CashShiftSummary['syncState'];
  report?: Record<string, unknown>;
  fiscalShift?: Record<string, unknown>;
  fiscal_shift?: Record<string, unknown>;
  printDocuments?: string[];
  printReportError?: string;
};

export type CashierShiftReportResponse = {
  printDocuments: string[];
};
