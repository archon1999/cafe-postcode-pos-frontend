import { describe, expect, it } from 'vitest';

import { getCashierOrderDisplayName, getCashierOrderNumberLabel } from './cashier-order.utils';

describe('cashier order display helpers', () => {
  it('uses the custom display name when provided', () => {
    expect(getCashierOrderDisplayName({ orderNumber: 24, displayName: 'VIP mijoz' })).toBe('VIP mijoz');
  });

  it('falls back to the formatted order number when custom name is empty', () => {
    expect(getCashierOrderDisplayName({ orderNumber: 24, displayName: '   ' })).toBe('A00024');
    expect(getCashierOrderNumberLabel({ orderNumber: 24 })).toBe('A00024');
  });
});
