import { normalizeEdgeOrigin } from 'shared/api/edgeConnection';

export type PairingCodeResponse = {
  code: string;
  expiresAt: string;
  coordinatorUrls: string[];
};

export async function requestPairingCode(origin: string, request: typeof fetch = fetch): Promise<PairingCodeResponse> {
  const normalizedOrigin = normalizeEdgeOrigin(origin);
  const response = await request(`${normalizedOrigin}/v1/pairing/codes`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: '{}',
  });
  const payload = (await response.json().catch(() => ({}))) as PairingCodeResponse & { detail?: string };
  if (!response.ok || !payload.code) {
    throw new Error(payload.detail || `Coordinator HTTP ${response.status}`);
  }
  return payload;
}
