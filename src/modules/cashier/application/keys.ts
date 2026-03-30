export const cashierKeys = {
  context: ['cashier', 'context'] as const,
  menu: ['cashier', 'menu'] as const,
  builderOrders: ['cashier', 'builder-orders'] as const,
  checks: (status: 'open' | 'closed') => ['cashier', 'checks', status] as const,
  paymentOrder: (orderId: string | null) => ['cashier', 'payment-order', orderId] as const,
};
