import type { CashierRepository } from 'modules/cashier/domain';
import { apiGet, apiPost } from 'shared/api/client';

type OpenShiftPayload = Parameters<CashierRepository['openShift']>[0];
type OpenShiftResponse = Awaited<ReturnType<CashierRepository['openShift']>>;
type CloseShiftPayload = Parameters<CashierRepository['closeShift']>[0];
type CloseShiftResponse = Awaited<ReturnType<CashierRepository['closeShift']>>;
type PrintShiftReportPayload = Parameters<CashierRepository['printShiftReport']>[0];
type PrintShiftReportResponse = Awaited<ReturnType<CashierRepository['printShiftReport']>>;
type FiscalShiftPayload = Exclude<Parameters<CashierRepository['openFiscalShift']>[0], undefined>;
type FiscalShiftResponse = Awaited<ReturnType<CashierRepository['openFiscalShift']>>;

const SHIFT_REPORT_REQUEST_TIMEOUT_MS = 10_000;

export const cashierShiftGateway = {
  getExpenses(cashShiftId?: string) {
    const query = cashShiftId ? `?cashShiftId=${encodeURIComponent(cashShiftId)}` : '';
    return apiGet<Awaited<ReturnType<CashierRepository['getExpenses']>>>(`/pos/billing/shifts/current/expenses/${query}`);
  },

  createExpense(payload: Parameters<CashierRepository['createExpense']>[0]) {
    return apiPost<Awaited<ReturnType<CashierRepository['createExpense']>>>(
      '/pos/billing/shifts/current/expenses/',
      payload,
    );
  },

  voidExpense(expenseId: string, reason: string) {
    return apiPost<Awaited<ReturnType<CashierRepository['voidExpense']>>>(
      `/pos/billing/expenses/${expenseId}/void/`,
      { reason },
    );
  },

  openShift(payload: OpenShiftPayload) {
    return apiPost<OpenShiftResponse>('/pos/billing/shifts/open/', payload);
  },

  closeShift(payload: CloseShiftPayload) {
    return apiPost<CloseShiftResponse>('/pos/billing/shifts/current/close/', payload);
  },

  printShiftReport(payload: PrintShiftReportPayload) {
    return apiPost<PrintShiftReportResponse>('/pos/billing/shifts/current/print-report/', payload, {
      timeout: SHIFT_REPORT_REQUEST_TIMEOUT_MS,
    });
  },

  openFiscalShift(payload?: FiscalShiftPayload) {
    return apiPost<FiscalShiftResponse>('/pos/billing/fiscal-shifts/open/', payload ?? {});
  },

  closeFiscalShift(payload?: FiscalShiftPayload) {
    return apiPost<FiscalShiftResponse>('/pos/billing/fiscal-shifts/close/', payload ?? {});
  },
};
