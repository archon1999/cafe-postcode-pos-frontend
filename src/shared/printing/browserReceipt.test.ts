// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { printReceiptWithFallback, receiptTextFromPayload } from './browserReceipt';

describe('browser receipt printing', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
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

  it('falls back to browser receipt HTML printing when local agent fails', async () => {
    type CapturedBlob = { parts: unknown[]; type: string };
    const blobs: CapturedBlob[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(JSON.stringify({ ok: false }), { status: 502 }))),
    );
    vi.stubGlobal(
      'Blob',
      class {
        parts: unknown[];
        type: string;

        constructor(parts: unknown[], options?: { type?: string }) {
          this.parts = parts;
          this.type = options?.type ?? '';
        }
      },
    );
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn((blob: CapturedBlob) => {
        blobs.push(blob);
        return 'blob:receipt';
      }),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });

    await printReceiptWithFallback({
      snapshot: {
        restaurant_name: 'Cafe',
        receipt_number: 'R-3',
        printed_at_label: '2026-06-01T10:00:00',
        items: [],
        total: 0,
      },
    });

    expect(blobs).toHaveLength(1);
    expect(blobs[0].type).toBe('text/html;charset=utf-8');
    expect(String(blobs[0].parts[0])).toContain('CHEK: R-3');
    expect(String(blobs[0].parts[0])).toContain('<pre>');
  });

  it('sends cyrillic-capable encoding to the local agent', async () => {
    const requests: Record<string, unknown>[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) => {
        requests.push(JSON.parse(String(init?.body)));
        return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
      }),
    );

    await printReceiptWithFallback({
      snapshot: {
        restaurant_name: 'Қамиш',
        receipt_number: 'R-4',
        printed_at_label: '2026-06-01T10:00:00',
        items: [],
        total: 0,
      },
    });

    expect(requests[0].encoding).toBe('cp1251');
    expect(requests[0].code_page).toBe(46);
  });
});
