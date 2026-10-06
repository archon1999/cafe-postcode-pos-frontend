export function unwrapMenuCollection<T>(payload: unknown): T[] {
  const categories = Array.isArray(payload)
    ? payload
    : payload && typeof payload === 'object'
      ? (payload as { data?: unknown }).data
      : undefined;

  if (
    !Array.isArray(categories) ||
    categories.some((category) => !category || typeof category !== 'object' || !Array.isArray(category.items))
  ) {
    throw new Error('Invalid menu response');
  }

  return categories as T[];
}
