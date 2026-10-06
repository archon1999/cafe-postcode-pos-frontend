import { describe, expect, it } from 'vitest';

import { unwrapMenuCollection } from './menuResponse';

describe('menu response validation', () => {
  it.each([undefined, null, '', {}, { data: undefined }, { code: 'local_response_too_large' }, [{}], [null]])(
    'rejects a missing or malformed menu instead of treating it as empty: %j',
    (payload) => {
      expect(() => unwrapMenuCollection(payload)).toThrow('Invalid menu response');
    },
  );

  it('accepts a real empty menu and wrapped menu responses', () => {
    expect(unwrapMenuCollection([])).toEqual([]);
    expect(unwrapMenuCollection({ data: [] })).toEqual([]);
    const categories = [{ id: 'category-1', items: [{ id: 'item-1' }] }];
    expect(unwrapMenuCollection(categories)).toBe(categories);
    expect(unwrapMenuCollection({ data: categories })).toBe(categories);
  });
});
