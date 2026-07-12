import { describe, expect, it, vi } from 'vitest';

import { requestPairingCode } from './edge-pairing-api';

describe('requestPairingCode', () => {
  it('posts directly to the selected local coordinator', async () => {
    const request = vi.fn(async () =>
      new Response(
        JSON.stringify({ code: '123456', expiresAt: '2026-07-11T12:00:00Z', coordinatorUrls: [] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await expect(requestPairingCode('http://127.0.0.1:18181/', request)).resolves.toMatchObject({ code: '123456' });
    expect(request).toHaveBeenCalledWith(
      'http://127.0.0.1:18181/v1/pairing/codes',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('surfaces coordinator errors', async () => {
    const request = vi.fn(async () =>
      new Response(JSON.stringify({ detail: 'Pairing disabled' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(requestPairingCode('http://127.0.0.1:18181', request)).rejects.toThrow('Pairing disabled');
  });
});
