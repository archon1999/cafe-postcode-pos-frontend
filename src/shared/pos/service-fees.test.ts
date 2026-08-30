import { describe, expect, it } from 'vitest';

import {
  buildServiceFeeRows,
  calculateBillableMinutes,
  calculateServiceFeeComponents,
  normalizeServiceFeeComponents,
} from './service-fees';

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

    expect(components?.[0]?.sourceName).toBe('VIP-1');
    expect(buildServiceFeeRows(components, labels)).toEqual([
      { scope: 'table', label: 'Stol xizmati (5%)', amount: 1500 },
    ]);
  });

  it('preserves an absent component list for legacy fee fallback', () => {
    expect(normalizeServiceFeeComponents(undefined)).toBeUndefined();
    expect(normalizeServiceFeeComponents(null)).toBeUndefined();
    expect(normalizeServiceFeeComponents([])).toEqual([]);
  });

  it('calculates hourly fees in complete five-minute blocks', () => {
    const startedAt = '2026-08-30T10:00:00.000Z';
    expect(calculateBillableMinutes(startedAt, '2026-08-30T11:31:00.000Z')).toBe(90);
    expect(calculateBillableMinutes(startedAt, '2026-08-30T11:34:59.000Z')).toBe(90);
    expect(calculateBillableMinutes(startedAt, '2026-08-30T11:35:00.000Z')).toBe(95);

    const components = calculateServiceFeeComponents(
      [
        { scope: 'restaurant', mode: 'percentage', percent: 10 },
        { scope: 'table', mode: 'hourly', hourlyRate: 100_000 },
      ],
      {
        subtotal: 30_000,
        startedAt,
        frozenAt: '2026-08-30T11:30:00.000Z',
      },
    );

    expect(components.map(({ amount }) => amount)).toEqual([3_000, 150_000]);
    expect(components[1]?.durationMinutes).toBe(90);
    expect(buildServiceFeeRows(components, labels)[1]).toEqual({
      scope: 'table',
      label: `Stol xizmati (${new Intl.NumberFormat('uz-UZ', { maximumFractionDigits: 0 }).format(100_000)} UZS/soat × 90 daq.)`,
      amount: 150_000,
    });
  });
});
