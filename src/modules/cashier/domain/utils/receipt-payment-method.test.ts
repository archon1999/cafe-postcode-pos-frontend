import { describe, expect, it } from 'vitest';

import type { CashierPaymentResponse } from '../entities/payment.types';

import { receiptPaymentMethod } from './receipt-payment-method';

describe('final receipt payment method', () => {
  const response: CashierPaymentResponse = {
    order: {
      id: 'order',
      orderNumber: 1,
      status: 'closed',
      subtotal: 27000,
      serviceFee: 0,
      total: 27000,
      note: '',
      channel: 'hall',
      items: [],
      payments: [
        { id: 'cash-first', method: 'cash', amount: 9000, status: 'succeeded' },
        { id: 'card', method: 'card', amount: 9000, status: 'succeeded' },
        { id: 'cash-last', method: 'cash', amount: 9000, status: 'succeeded' },
      ],
    },
    payment: { id: 'cash-last', method: 'cash', amount: 9000 },
    receipt: null,
  };
  it('shows mixed when the last part was cash, including recovered results', () => {
    expect(receiptPaymentMethod(response)).toBe('mixed');
  });
  it('ignores rejected parts and does not alter the operation payment', () => {
    const original = JSON.stringify(response);
    const cashOnly = structuredClone(response);
    cashOnly.order.payments![1].status = 'failed';
    expect(receiptPaymentMethod(cashOnly)).toBe('cash');
    expect(JSON.stringify(response)).toBe(original);
    expect(receiptPaymentMethod({ ...response, order: { ...response.order, status: 'open' } })).toBe('cash');
  });
});
