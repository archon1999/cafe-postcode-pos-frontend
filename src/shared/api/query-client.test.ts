import { describe, expect, it, vi } from 'vitest';

import { invalidateQueriesInBackground, queryClient } from './query-client';

describe('invalidateQueriesInBackground', () => {
  it('starts all invalidations without waiting for active query refetches', () => {
    const pending = new Promise<never>(() => undefined);
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockReturnValue(pending);

    const result = invalidateQueriesInBackground([
      ['cashier', 'context'],
      ['cashier', 'checks'],
    ]);

    expect(result).toBeUndefined();
    expect(invalidate).toHaveBeenCalledTimes(2);
    expect(invalidate).toHaveBeenNthCalledWith(1, { queryKey: ['cashier', 'context'] });
    expect(invalidate).toHaveBeenNthCalledWith(2, { queryKey: ['cashier', 'checks'] });

    invalidate.mockRestore();
  });
});
