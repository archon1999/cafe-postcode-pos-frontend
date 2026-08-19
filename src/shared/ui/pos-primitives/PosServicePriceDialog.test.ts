import { describe, expect, it } from 'vitest';

import { parseServicePrice } from './PosServicePriceDialog';

describe('parseServicePrice', () => {
  it.each([
    ['75000', 75000],
    ['75 000', 75000],
    ['1', 1],
  ])('parses %s as %s', (input, expected) => {
    expect(parseServicePrice(input)).toBe(expected);
  });

  it.each(['', '0', '-1', '1.5', 'abc', '2147483648'])('rejects %s', (input) => {
    expect(parseServicePrice(input)).toBeNull();
  });
});
