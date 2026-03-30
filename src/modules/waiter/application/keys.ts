export const waiterKeys = {
  halls: ['waiter', 'halls'] as const,
  menu: ['waiter', 'menu'] as const,
  orders: ['waiter', 'orders'] as const,
  tableSession: (sessionId: string | null) => ['waiter', 'table-session', sessionId] as const,
  sessionOrders: (sessionId: string | null) => ['waiter', 'session-orders', sessionId] as const,
  takeawayOrders: (userId: string | undefined) => ['waiter', 'takeaway-orders', userId] as const,
};
