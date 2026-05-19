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

export type MartaPaymentInitiateResponse = {
  payment: CashierPaymentResponse['payment'];
  marta: {
    endpointUrl?: string;
    endpoint_url?: string;
    pid: number;
    amount: number;
    amountMultiplier?: number;
    amount_multiplier?: number;
    taxNumber?: string;
    tax_number?: string;
    timeoutSeconds?: number;
    timeout_seconds?: number;
  };
};

export type MartaTerminalResultPayload = {
  ok: boolean;
  status: string;
  requestId?: string;
  pid?: number;
  message?: string;
  params?: Record<string, unknown>;
  ac?: unknown;
  debug?: Record<string, unknown>;
  response?: Record<string, unknown>;
  browserError?: Record<string, unknown>;
};
