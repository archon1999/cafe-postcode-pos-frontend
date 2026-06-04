import { describe, expect, it } from 'vitest';

import { receiptTextFromPayload } from './browserReceipt';

describe('browser receipt printing', () => {
  it('prints delivery phone and address in the header', () => {
    const text = receiptTextFromPayload({
      snapshot: {
        restaurant_name: 'Cafe',
        receipt_number: 'R-1',
        printed_at_label: '2026-06-01T10:00:00',
        delivery_phone: '90-123-45-67',
        delivery_address: 'Chilonzor 12',
        items: [],
        total: 0,
      },
    });

    expect(text).toContain('TEL:');
    expect(text).toContain('90-123-45-67');
    expect(text).toContain('MANZIL: Chilonzor 12');
  });

  it('prints service fee and VAT percentages in totals', () => {
    const text = receiptTextFromPayload({
      snapshot: {
        restaurant_name: 'Cafe',
        receipt_number: 'R-2',
        printed_at_label: '2026-06-01T10:00:00',
        items: [],
        subtotal: 40000,
        service_fee: 4000,
        service_fee_percent: 10,
        vat_enabled: true,
        vat_percent: 12,
        vat_amount: 4714,
        total: 44000,
      },
    });

    expect(text).toContain('Sh.j. QQS (12%):');
    expect(text).toContain('XIZMAT HAQI (10%):');
  });
});
