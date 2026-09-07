import { describe, expect, it } from 'vitest';

import { isValidOpeningCash } from './opening-cash';

describe('opening cash contract', () => {
  it.each(['-1', '-0.1', '0.5', '', ' ', 'NaN', 'Infinity', 'abc', '2147483648'])('rejects %s', (value) => {
    expect(isValidOpeningCash(value)).toBe(false);
  });
  it.each(['0', '50000', '2147483647'])('accepts %s', (value) => {
    expect(isValidOpeningCash(value)).toBe(true);
  });
});
