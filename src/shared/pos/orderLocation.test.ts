import { describe, expect, it } from 'vitest';

import { getPosOrderLocationLabel, getPosTableNumberLabel, getPosZoneContextLabel } from './orderLocation';

describe('POS order location', () => {
  it('uses the canonical table number before the legacy name fallback', () => {
    expect(getPosTableNumberLabel({ tableNumber: 23, tableName: 'VIP 7-stol' })).toBe('23');
    expect(getPosTableNumberLabel({ tableName: 'VIP 7-stol' })).toBe('7');
  });

  it('hides the zone for single-zone restaurants', () => {
    const location = { zoneName: 'Asosiy zona', showZoneName: false, hallName: 'Asosiy zal' };
    expect(getPosZoneContextLabel(location)).toBe('');
    expect(getPosOrderLocationLabel(location)).toBe('Asosiy zal');
  });

  it('includes the zone in a multi-zone location without duplicate names', () => {
    expect(
      getPosOrderLocationLabel(
        {
          zoneName: 'VIP kabina',
          showZoneName: true,
          hallName: 'VIP zal',
          tableName: '23-stol',
        },
        { includeTable: true, separator: ', ' },
      ),
    ).toBe('VIP kabina, VIP zal, 23-stol');
  });
});
