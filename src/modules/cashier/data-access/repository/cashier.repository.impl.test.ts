import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CashierPaymentResponse } from 'modules/cashier/domain';

const { apiPostMock } = vi.hoisted(() => ({ apiPostMock: vi.fn() }));

vi.mock('shared/api/client', () => ({
  apiDelete: vi.fn(),
  apiGet: vi.fn(),
  apiPatch: vi.fn(),
  apiPost: (...args: unknown[]) => apiPostMock(...args),
  unwrapCollection: vi.fn(),
}));

import { cashierRepository } from './cashier.repository.impl';
import { cashierPaymentGateway } from './cashierPaymentGateway';
import { cashierShiftGateway } from './cashierShiftGateway';

function paymentResponse(orderNumber = 77) {
  return {
    order: {
      id: 'order-1',
      order_number: orderNumber,
      status: 'closed',
      subtotal: 125_000,
      serviceFee: 0,
      total: 125_000,
      note: '',
      channel: 'takeaway',
      items: [],
    },
    payment: { id: 'payment-1', method: 'cash', amount: 125_000 },
    receipt: null,
  } as unknown as CashierPaymentResponse;
}

describe('cashier repository transport contract', () => {
  beforeEach(() => {
    apiPostMock.mockReset();
  });

  it('exposes the exact shift gateway function references', () => {
    expect(cashierRepository.openShift).toBe(cashierShiftGateway.openShift);
    expect(cashierRepository.closeShift).toBe(cashierShiftGateway.closeShift);
    expect(cashierRepository.printShiftReport).toBe(cashierShiftGateway.printShiftReport);
    expect(cashierRepository.openFiscalShift).toBe(cashierShiftGateway.openFiscalShift);
    expect(cashierRepository.closeFiscalShift).toBe(cashierShiftGateway.closeFiscalShift);
  });

  it('exposes the exact payment gateway function references', () => {
    expect(cashierRepository.payOrder).toBe(cashierPaymentGateway.payOrder);
    expect(cashierRepository.createPrecheckPrintDocument).toBe(cashierPaymentGateway.createPrecheckPrintDocument);
    expect(cashierRepository.retryFiscalPayment).toBe(cashierPaymentGateway.retryFiscalPayment);
    expect(cashierRepository.refundPayment).toBe(cashierPaymentGateway.refundPayment);
    expect(cashierRepository.ensurePaymentPrintDocument).toBe(cashierPaymentGateway.ensurePaymentPrintDocument);
  });

  it('opens a cash shift with the exact payload and returns the response by identity', async () => {
    const payload = {
      cashDeskId: 'cash-desk-1',
      cashierId: 'cashier-1',
      openingCashAmount: 125_000,
      notesOpen: 'morning shift',
    };
    const response = { shift: { id: 'shift-1' } };
    apiPostMock.mockResolvedValueOnce(response);

    const result = await cashierRepository.openShift(payload);

    expect(apiPostMock).toHaveBeenCalledWith('/pos/billing/shifts/open/', payload);
    expect(result).toBe(response);
  });

  it('closes the current cash shift with the exact payload and returns the response by identity', async () => {
    const payload = {
      cashShiftId: 'shift-1',
      actualClosingCashAmount: 175_000,
      notesClose: 'evening close',
      closeFiscalShift: true,
    };
    const response = { shift: { id: 'shift-1', status: 'closed' }, printDocuments: ['document-1'] };
    apiPostMock.mockResolvedValueOnce(response);

    const result = await cashierRepository.closeShift(payload);

    expect(apiPostMock).toHaveBeenCalledWith('/pos/billing/shifts/current/close/', payload);
    expect(result).toBe(response);
  });

  it('requests the current shift report with the exact payload and returns the response by identity', async () => {
    const payload = { cashShiftId: 'shift-1' };
    const response = { printDocuments: ['general-report', 'fiscal-report'] };
    apiPostMock.mockResolvedValueOnce(response);

    const result = await cashierRepository.printShiftReport(payload);

    expect(apiPostMock).toHaveBeenCalledWith('/pos/billing/shifts/current/print-report/', payload, {
      timeout: 10_000,
    });
    expect(result).toBe(response);
  });

  it('opens a fiscal shift and normalizes an omitted payload to an empty object', async () => {
    const response = { terminalId: 'terminal-1', opened: true };
    apiPostMock.mockResolvedValue(response);

    await expect(cashierRepository.openFiscalShift()).resolves.toBe(response);
    expect(apiPostMock).toHaveBeenLastCalledWith('/pos/billing/fiscal-shifts/open/', {});

    const payload = { cashDeskId: 'cash-desk-1' };
    await expect(cashierRepository.openFiscalShift(payload)).resolves.toBe(response);
    expect(apiPostMock).toHaveBeenLastCalledWith('/pos/billing/fiscal-shifts/open/', payload);
  });

  it('closes a fiscal shift and normalizes an omitted payload to an empty object', async () => {
    const response = { terminalId: 'terminal-1', closed: true };
    apiPostMock.mockResolvedValue(response);

    await expect(cashierRepository.closeFiscalShift()).resolves.toBe(response);
    expect(apiPostMock).toHaveBeenLastCalledWith('/pos/billing/fiscal-shifts/close/', {});

    const payload = { cashDeskId: 'cash-desk-1' };
    await expect(cashierRepository.closeFiscalShift(payload)).resolves.toBe(response);
    expect(apiPostMock).toHaveBeenLastCalledWith('/pos/billing/fiscal-shifts/close/', payload);
  });

  it('pays an order with the current defaults and maps the returned order', async () => {
    const response = paymentResponse();
    apiPostMock.mockResolvedValueOnce(response);

    const result = await cashierRepository.payOrder('order-1', 'cash', 125_000);

    expect(apiPostMock).toHaveBeenCalledWith('/pos/billing/orders/order-1/pay/', {
      method: 'cash',
      amount: 125_000,
      cashAmount: undefined,
      cardAmount: undefined,
      registerFiscal: true,
      manualCardOverride: false,
      manualCardReason: '',
    });
    expect(result).not.toBe(response);
    expect(result.order).not.toBe(response.order);
    expect(result.order.orderNumber).toBe(77);
    expect(result.payment).toBe(response.payment);
    expect(result.receipt).toBe(response.receipt);
  });

  it('creates an order precheck print document without sending payment data', async () => {
    const response = { printDocument: 'precheck-document-1' };
    apiPostMock.mockResolvedValueOnce(response);

    await expect(cashierRepository.createPrecheckPrintDocument('order-1')).resolves.toBe(response);
    expect(apiPostMock).toHaveBeenCalledWith('/pos/billing/orders/order-1/precheck/print-document/');
  });

  it('forwards every explicit payment option without changing its value', async () => {
    const response = paymentResponse(78);
    apiPostMock.mockResolvedValueOnce(response);

    const result = await cashierRepository.payOrder('order-2', 'mixed', 100_000, {
      cashAmount: 40_000,
      cardAmount: 60_000,
      registerFiscal: false,
      manualCardOverride: true,
      manualCardReason: 'terminal unavailable',
    });

    expect(apiPostMock).toHaveBeenCalledWith('/pos/billing/orders/order-2/pay/', {
      method: 'mixed',
      amount: 100_000,
      cashAmount: 40_000,
      cardAmount: 60_000,
      registerFiscal: false,
      manualCardOverride: true,
      manualCardReason: 'terminal unavailable',
    });
    expect(result.order.orderNumber).toBe(78);
  });

  it('sends the cashier final total and its audit reason only when provided', async () => {
    const response = paymentResponse(79);
    apiPostMock.mockResolvedValueOnce(response);

    await cashierRepository.payOrder('order-3', 'cash', 50_000, {
      finalTotal: 50_000,
      totalOverrideReason: 'Kelishilgan narx',
    });

    expect(apiPostMock).toHaveBeenCalledWith('/pos/billing/orders/order-3/pay/', {
      method: 'cash',
      amount: 50_000,
      cashAmount: undefined,
      cardAmount: undefined,
      registerFiscal: true,
      manualCardOverride: false,
      manualCardReason: '',
      finalTotal: 50_000,
      totalOverrideReason: 'Kelishilgan narx',
    });
  });

  it('retries fiscal registration through the payment-scoped endpoint and returns the response by identity', async () => {
    const response = { payment: { id: 'payment-1' }, receipt: null, result: { success: false } };
    apiPostMock.mockResolvedValueOnce(response);

    await expect(cashierRepository.retryFiscalPayment('payment-1')).resolves.toBe(response);
    expect(apiPostMock).toHaveBeenCalledWith('/pos/billing/payments/payment-1/retry-fiscal/');
  });

  it('refunds through the current endpoint and preserves default and explicit reasons', async () => {
    const response = { refund: { id: 'refund-1' }, receipt: null };
    apiPostMock.mockResolvedValue(response);

    await expect(cashierRepository.refundPayment('payment-1')).resolves.toBe(response);
    expect(apiPostMock).toHaveBeenLastCalledWith('/pos/billing/payment-1/refund/', { reason: '' });

    await expect(cashierRepository.refundPayment('payment-1', 'customer request')).resolves.toBe(response);
    expect(apiPostMock).toHaveBeenLastCalledWith('/pos/billing/payment-1/refund/', { reason: 'customer request' });
  });

  it('ensures a printable payment document and returns the response by identity', async () => {
    const response = { receipt: { id: 'receipt-1', status: 'created' } };
    apiPostMock.mockResolvedValueOnce(response);

    await expect(cashierRepository.ensurePaymentPrintDocument('payment-1')).resolves.toBe(response);
    expect(apiPostMock).toHaveBeenCalledWith('/pos/billing/payments/payment-1/print-document/');
  });
});
