import type { CashierOrder } from './order.types';

export type PaymentMethod = 'cash' | 'card' | 'mixed';

export type CashierFiscalReceipt = {
  id: string;
  payload?: {
    receiptNumber?: string;
    receipt_number?: string;
    issuedAt?: string;
    issued_at?: string;
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
    cash_amount?: number | string;
    cardAmount?: number | string;
    card_amount?: number | string;
    fiscalCashAmount?: number | string;
    fiscal_cash_amount?: number | string;
    fiscalCardAmount?: number | string;
    fiscal_card_amount?: number | string;
    fiscalAdjustmentReason?: string;
    fiscal_adjustment_reason?: string;
    externalRef?: string;
    providerPayload?: Record<string, unknown> | null;
    paidAt?: string;
  };
  receipt: CashierFiscalReceipt;
  receipts?: CashierFiscalReceipt[];
};
