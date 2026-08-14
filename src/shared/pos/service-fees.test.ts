import { describe, expect, it } from 'vitest';

import { buildServiceFeeRows, normalizeServiceFeeComponents } from './service-fees';

const labels = {
  restaurant: 'Restoran xizmati',
  hall: 'Zal xizmati',
  table: 'Stol xizmati',
};

describe('service fee presentation', () => {
  it('keeps restaurant, hall, and table charges as separate rows', () => {
    expect(
      buildServiceFeeRows(
        [
          { scope: 'restaurant', percent: 10, amount: 3000 },
          { scope: 'hall', percent: 3, amount: 900 },
          { scope: 'table', percent: 2, amount: 600 },
        ],
        labels,
      ),
    ).toEqual([
      { scope: 'restaurant', label: 'Restoran xizmati (10%)', amount: 3000 },
      { scope: 'hall', label: 'Zal xizmati (3%)', amount: 900 },
      { scope: 'table', label: 'Stol xizmati (2%)', amount: 600 },
    ]);
  });

  it('shows a table-only fee and normalizes API source names', () => {
    const components = normalizeServiceFeeComponents([
      { scope: 'table', source_name: 'VIP-1', percent: '5.00', amount: 1500 },
    ]);

    expect(components[0]?.sourceName).toBe('VIP-1');
    expect(buildServiceFeeRows(components, labels)).toEqual([
      { scope: 'table', label: 'Stol xizmati (5%)', amount: 1500 },
    ]);
  });
});
