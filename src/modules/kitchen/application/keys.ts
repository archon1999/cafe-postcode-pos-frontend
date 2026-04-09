export const kitchenKeys = {
  queue: ['kitchen', 'queue'] as const,
  monitorQueue: (restaurantId: string | null) => ['kitchen', 'monitor', restaurantId] as const,
};
