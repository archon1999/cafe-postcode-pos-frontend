// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { printReceiptWithFallback, receiptTextFromPayload } from './browserReceipt';

const { apiPostMock } = vi.hoisted(() => ({
  apiPostMock: vi.fn(),
}));

vi.mock('shared/api/client', () => ({
  apiPost: (...args: unknown[]) => apiPostMock(...args),
}));

describe('browser receipt printing', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    apiPostMock.mockReset();
  });

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

    expect(text).toContain('Mijoz tel:');
    expect(text).toContain('90-123-45-67');
    expect(text).toContain('Mijoz manzil: Chilonzor 12');
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

  it('prints through backend receipt endpoint when receipt id is provided', async () => {
    apiPostMock.mockResolvedValueOnce({ result: { ok: true } });

    const printed = await printReceiptWithFallback(
      {
        snapshot: {
          restaurant_name: 'Cafe',
          receipt_number: 'R-3',
          printed_at_label: '2026-06-01T10:00:00',
          items: [],
          total: 0,
        },
      },
      { receiptId: 'receipt-3' },
    );

    expect(printed).toBe(true);
    expect(apiPostMock).toHaveBeenCalledWith('/pos/billing/receipts/receipt-3/print/', {
      payload: expect.any(Object),
      text: expect.stringContaining('R-3'),
      qr_code: '',
    });
  });

  it('prints through backend generic endpoint without local browser fallback', async () => {
    apiPostMock.mockResolvedValueOnce({ result: { ok: false } });

    const printed = await printReceiptWithFallback({
      snapshot: {
        restaurant_name: 'Qamish',
        receipt_number: 'R-4',
        printed_at_label: '2026-06-01T10:00:00',
        items: [],
        total: 0,
      },
    });

    expect(printed).toBe(false);
    expect(apiPostMock).toHaveBeenCalledWith('/pos/billing/receipts/print/', {
      payload: expect.any(Object),
      text: expect.stringContaining('R-4'),
      qr_code: '',
    });
  });

  it('sends fiscal QR as structured QR code instead of printing the URL in text', async () => {
    apiPostMock.mockResolvedValueOnce({ result: { ok: true } });

    const printed = await printReceiptWithFallback({
      snapshot: {
        restaurant_name: 'Cafe',
        receipt_number: 'R-5',
        printed_at_label: '2026-06-01T10:00:00',
        items: [],
        total: 0,
        qr_code_url: 'https://ofd.soliq.uz/check?r=R-5',
      },
    });

    expect(printed).toBe(true);
    expect(apiPostMock).toHaveBeenCalledWith('/pos/billing/receipts/print/', {
      payload: expect.any(Object),
      text: expect.not.stringContaining('https://ofd.soliq.uz/check'),
      qr_code: 'https://ofd.soliq.uz/check?r=R-5',
    });
  });

  it('keeps order number separate from fiscal receipt sequence', () => {
    const text = receiptTextFromPayload({
      order_number: 1,
      receipt_number: '6',
      channel_label: 'Dostavka',
      request: {
        Receipt: {
          Operation: 0,
          Time: '2026-07-02T12:37:17',
          ReceivedCash: 7400000,
          ReceivedCard: 0,
          Items: [{ Name: 'BBQ CHEESEBURGER', Amount: 1000, Price: 2800000 }],
        },
      },
      response: {
        ReceiptSeq: '6',
      },
    });

    expect(text).toContain('Buyurtma raqami: 1');
    expect(text).toContain('Buyurtma turi: Dostavka');
    expect(text).toContain('CHEK:');
    expect(text).toContain('6');
    expect(text).not.toContain('Buyurtma raqami: 6');
  });
});
