import { describe, expect, it } from 'vitest';

import { formatDeliveryPhoneInput, isValidDeliveryPhone, normalizeDeliveryAddress } from './delivery-details.utils';

describe('delivery details utils', () => {
  it('formats a 9 digit delivery phone as DD-DDD-DD-DD', () => {
    expect(formatDeliveryPhoneInput('901234567')).toBe('90-123-45-67');
  });

  it('ignores non-digits and caps the delivery phone at 9 digits', () => {
    expect(formatDeliveryPhoneInput('+998 90 123 45 67 89')).toBe('99-890-12-34');
  });

  it('validates the formatted delivery phone and trims address text', () => {
    expect(isValidDeliveryPhone('90-123-45-67')).toBe(true);
    expect(isValidDeliveryPhone('901234567')).toBe(false);
    expect(normalizeDeliveryAddress('  Chilonzor 12  ')).toBe('Chilonzor 12');
  });
});
