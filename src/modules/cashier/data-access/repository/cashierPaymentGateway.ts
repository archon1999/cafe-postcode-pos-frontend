import type { CashierRepository } from 'modules/cashier/domain';
import { apiPost, apiRecoverFinancialCommand } from 'shared/api/client';

import { mapCashierPaymentResponse, mapCashierReceipt } from '../mappers';

type PayOrderMethod = Parameters<CashierRepository['payOrder']>[1];
type PayOrderAmount = Parameters<CashierRepository['payOrder']>[2];
type PayOrderOptions = Exclude<Parameters<CashierRepository['payOrder']>[3], undefined>;
type PayOrderResponse = Awaited<ReturnType<CashierRepository['payOrder']>>;
type RetryFiscalPaymentResponse = Awaited<ReturnType<CashierRepository['retryFiscalPayment']>>;
type RefundReason = Exclude<Parameters<CashierRepository['refundPayment']>[1], undefined>;
type RefundPaymentResponse = Awaited<ReturnType<CashierRepository['refundPayment']>>;
type PaymentPrintDocumentResponse = Awaited<ReturnType<CashierRepository['ensurePaymentPrintDocument']>>;
type PrecheckPrintDocumentResponse = Awaited<ReturnType<CashierRepository['createPrecheckPrintDocument']>>;

export const cashierPaymentGateway = {
  async recoverPayment(orderId: string, allowRetry = false) {
    const response = await apiRecoverFinancialCommand<PayOrderResponse>(
      `/pos/billing/orders/${orderId}/pay/`,
      allowRetry,
    );
    return response ? mapCashierPaymentResponse(response) : null;
  },
  createPrecheckPrintDocument(orderId: string) {
    return apiPost<PrecheckPrintDocumentResponse>(`/pos/billing/orders/${orderId}/precheck/print-document/`);
  },

  async payOrder(
    orderId: string,
    method: PayOrderMethod,
    amount: PayOrderAmount,
    options?: PayOrderOptions,
  ): Promise<PayOrderResponse> {
    return mapCashierPaymentResponse(
      await apiPost<PayOrderResponse>(`/pos/billing/orders/${orderId}/pay/`, {
        method,
        amount,
        cashAmount: options?.cashAmount,
        cardAmount: options?.cardAmount,
        registerFiscal: options?.registerFiscal ?? true,
        manualCardOverride: Boolean(options?.manualCardOverride),
        manualCardReason: options?.manualCardReason ?? '',
        ...(options?.finalTotal !== undefined ? { finalTotal: options.finalTotal } : {}),
        ...(options?.serviceFeeQuote ? { serviceFeeQuote: options.serviceFeeQuote } : {}),
      }),
    );
  },

  async retryFiscalPayment(paymentId: string) {
    const response = await apiPost<RetryFiscalPaymentResponse>(`/pos/billing/payments/${paymentId}/retry-fiscal/`);
    return {
      ...response,
      receipt: response.receipt ? mapCashierReceipt(response.receipt) : response.receipt,
      ...(response.receipts ? { receipts: response.receipts.map(mapCashierReceipt) } : {}),
    };
  },

  refundPayment(
    paymentId: string,
    reason: RefundReason = '',
    manualSettlementConfirmed?: boolean,
    refundWholeOrder?: boolean,
  ) {
    return apiPost<RefundPaymentResponse>(`/pos/billing/${paymentId}/refund/`, {
      reason,
      ...(manualSettlementConfirmed === undefined ? {} : { manualSettlementConfirmed }),
      ...(refundWholeOrder ? { refundWholeOrder } : {}),
    });
  },

  ensurePaymentPrintDocument(paymentId: string) {
    return apiPost<PaymentPrintDocumentResponse>(`/pos/billing/payments/${paymentId}/print-document/`);
  },
};
