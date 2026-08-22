import { describe, expect, it } from 'vitest';

import { calculatePercentageDiscount } from './payment-total-adjustment';

describe('calculatePercentageDiscount', () => {
  it('calculates a percentage discount using integer som rounding', () => {
    expect(calculatePercentageDiscount(200_000, '10')).toEqual({
      discountAmount: 20_000,
      finalTotal: 180_000,
      isValid: true,
      percent: 10,
    });
    expect(calculatePercentageDiscount(99_999, '12.5')).toMatchObject({
      discountAmount: 12_500,
      finalTotal: 87_499,
      isValid: true,
    });
  });

  it('accepts a comma decimal separator and rejects empty or 100 percent', () => {
    expect(calculatePercentageDiscount(100_000, '2,5')).toMatchObject({
      discountAmount: 2_500,
      finalTotal: 97_500,
      isValid: true,
    });
    expect(calculatePercentageDiscount(100_000, '')).toMatchObject({ isValid: false });
    expect(calculatePercentageDiscount(100_000, '100')).toMatchObject({ isValid: false });
  });
});
