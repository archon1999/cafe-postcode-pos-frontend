import type { CashierRepository } from 'modules/cashier/domain';
import { apiPost } from 'shared/api/client';

type OpenShiftPayload = Parameters<CashierRepository['openShift']>[0];
type OpenShiftResponse = Awaited<ReturnType<CashierRepository['openShift']>>;
type CloseShiftPayload = Parameters<CashierRepository['closeShift']>[0];
type CloseShiftResponse = Awaited<ReturnType<CashierRepository['closeShift']>>;
type PrintShiftReportPayload = Parameters<CashierRepository['printShiftReport']>[0];
type PrintShiftReportResponse = Awaited<ReturnType<CashierRepository['printShiftReport']>>;
type FiscalShiftPayload = Exclude<Parameters<CashierRepository['openFiscalShift']>[0], undefined>;
type FiscalShiftResponse = Awaited<ReturnType<CashierRepository['openFiscalShift']>>;

export const cashierShiftGateway = {
  openShift(payload: OpenShiftPayload) {
    return apiPost<OpenShiftResponse>('/pos/billing/shifts/open/', payload);
  },

  closeShift(payload: CloseShiftPayload) {
    return apiPost<CloseShiftResponse>('/pos/billing/shifts/current/close/', payload);
  },

  printShiftReport(payload: PrintShiftReportPayload) {
    return apiPost<PrintShiftReportResponse>('/pos/billing/shifts/current/print-report/', payload);
  },

  openFiscalShift(payload?: FiscalShiftPayload) {
    return apiPost<FiscalShiftResponse>('/pos/billing/fiscal-shifts/open/', payload ?? {});
  },

  closeFiscalShift(payload?: FiscalShiftPayload) {
    return apiPost<FiscalShiftResponse>('/pos/billing/fiscal-shifts/close/', payload ?? {});
  },
};
