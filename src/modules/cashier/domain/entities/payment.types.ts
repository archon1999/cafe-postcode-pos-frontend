import type { CashierOrder } from './order.types';

export type PaymentMethod = 'cash' | 'card' | 'mixed';

export type CashierFiscalReceipt = {
  id: string;
  kind?: 'plain' | 'fiscal' | 'refund';
  status?: 'created' | 'sent' | 'failed' | 'unknown' | 'registering';
  fiscalState?: 'pending' | 'registered' | 'unknown' | 'failed';
  ofdState?: 'pending' | 'acknowledged' | 'unknown';
  printDocument?: string | null;
  fiscalErrorMessage?: string | null;
  payload?: {
    receiptNumber?: string;
    issuedAt?: string;
  };
  createdAt?: string;
} | null;

export type CashierPaymentResponse = {
  financialCommand?: { commandId: string; state: 'processing' | 'succeeded' | 'failed' | 'unknown'; stage?: string };
  syncState?: 'pending' | 'acknowledged' | 'action_required';
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
  kitchenPrintDocuments?: string[];
};
