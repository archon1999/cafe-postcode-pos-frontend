import type { CashierOrder } from './order.types';

export type PaymentMethod = 'cash' | 'card' | 'qr';

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
    externalRef?: string;
    providerPayload?: Record<string, unknown> | null;
    paidAt?: string;
  };
  receipt: CashierFiscalReceipt;
  receipts?: CashierFiscalReceipt[];
};
