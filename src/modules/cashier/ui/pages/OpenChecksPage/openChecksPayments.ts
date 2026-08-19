import type { CashierOrder } from 'modules/cashier/domain/entities/order.types';

export type CashierOrderPayment = NonNullable<CashierOrder['payments']>[number];
export type CashierOrderPaymentMethod = CashierOrderPayment['method'];

export function getSucceededPayments(payments: CashierOrder['payments']): CashierOrderPayment[] {
  return (payments ?? []).filter((payment) => payment.status === 'succeeded');
}

function parsePaymentTimestamp(value: string | null | undefined) {
  if (!value) {
    return Number.NEGATIVE_INFINITY;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
}

function comparePaymentsByRecency(left: CashierOrderPayment, right: CashierOrderPayment) {
  const leftPaidAt = parsePaymentTimestamp(left.paidAt);
  const rightPaidAt = parsePaymentTimestamp(right.paidAt);
  const leftCreatedAt = parsePaymentTimestamp(left.createdAt);
  const rightCreatedAt = parsePaymentTimestamp(right.createdAt);
  const leftTimestamp = leftPaidAt === Number.NEGATIVE_INFINITY ? leftCreatedAt : leftPaidAt;
  const rightTimestamp = rightPaidAt === Number.NEGATIVE_INFINITY ? rightCreatedAt : rightPaidAt;

  if (leftTimestamp !== rightTimestamp) {
    return leftTimestamp - rightTimestamp;
  }

  if (leftCreatedAt !== rightCreatedAt) {
    return leftCreatedAt - rightCreatedAt;
  }

  return left.id.localeCompare(right.id);
}

export function selectLatestSucceededPayment(payments: CashierOrder['payments']) {
  return getSucceededPayments(payments).reduce<CashierOrderPayment | undefined>(
    (latest, payment) => (!latest || comparePaymentsByRecency(payment, latest) > 0 ? payment : latest),
    undefined,
  );
}

export function selectLatestUnrefundedSucceededPayment(payments: CashierOrder['payments']) {
  return getSucceededPayments(payments)
    .filter((payment) => !payment.isRefunded)
    .reduce<CashierOrderPayment | undefined>(
      (latest, payment) => (!latest || comparePaymentsByRecency(payment, latest) > 0 ? payment : latest),
      undefined,
    );
}

export function deriveSucceededPaymentMethod(
  payments: CashierOrder['payments'],
): CashierOrderPaymentMethod | undefined {
  const methods = new Set(getSucceededPayments(payments).map((payment) => payment.method));

  if (methods.has('mixed') || methods.size > 1) {
    return 'mixed';
  }

  return methods.values().next().value;
}
