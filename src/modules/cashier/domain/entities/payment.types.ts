import type { CashierOrder } from './order.types';

export type PaymentMethod = 'cash' | 'card' | 'mixed';

export type CashierFiscalReceipt = {
  id: string;
  status?: 'created' | 'sent' | 'failed';
  printDocument?: string | null;
  fiscalErrorMessage?: string | null;
  payload?: {
    receiptNumber?: string;
    issuedAt?: string;
  };
  createdAt?: string;
} | null;

export type CashierPaymentResponse = {
  order: CashierOrder;
  payment: {
    id: string;
    method: PaymentMethod;
    amount: number | string;
    cashAmount?: number | string;
    cardAmount?: number | string;
    fiscalCashAmount?: number | string;
    fiscalCardAmount?: number | string;
    fiscalAdjustmentReason?: string;
    fiscal_adjustment_reason?: string;
    externalRef?: string;
    providerPayload?: Record<string, unknown> | null;
    paidAt?: string;
  };
  receipt: CashierFiscalReceipt;
  receipts?: CashierFiscalReceipt[];
};
