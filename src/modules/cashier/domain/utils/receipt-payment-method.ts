import type { CashierPaymentResponse, PaymentMethod } from '../entities/payment.types';

export function receiptPaymentMethod(response: CashierPaymentResponse | null): PaymentMethod | undefined {
  if (!response || response.order.status !== 'closed') return response?.payment.method;
  const succeeded = (response.order.payments ?? []).filter((payment) => payment.status === 'succeeded');
  const payments = succeeded.some((payment) => payment.id === response.payment.id)
    ? succeeded
    : [...succeeded, response.payment];
  const cash = payments.some((payment) => Number(payment.cashAmount) > 0 || payment.method === 'cash');
  const card = payments.some((payment) => Number(payment.cardAmount) > 0 || ['card', 'qr'].includes(payment.method));
  if ((cash && card) || payments.some((payment) => payment.method === 'mixed')) return 'mixed';
  return card ? 'card' : cash ? 'cash' : response.payment.method;
}
