// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { persistTransportConnection } from 'shared/api/edgeConnection';

import { EdgePrintError } from '../../domain';

import { EdgePrintRepositoryImpl } from './edge-print.repository.impl';

const fetchMock = vi.fn();
const { apiPostMock } = vi.hoisted(() => ({ apiPostMock: vi.fn() }));

vi.mock('shared/api/client', () => ({ apiPost: (...args: unknown[]) => apiPostMock(...args) }));

function job(status: 'queued' | 'succeeded' | 'failed' | 'dispatch_unknown') {
  return {
    operationId: 'pos:operation-1',
    documentId: '11111111-1111-1111-1111-111111111111',
    copies: 1,
    status,
    attempts: 1,
    lastError: status === 'failed' ? 'printer offline' : '',
    createdAt: '2026-07-10T11:45:00Z',
    updatedAt: '2026-07-10T11:45:01Z',
  };
}

function response(status: number, body: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

describe('EdgePrintRepositoryImpl', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    window.localStorage.clear();
    apiPostMock.mockReset();
  });

  it('submits only a document id, operation id and copies to local Edge', async () => {
    fetchMock.mockReturnValueOnce(response(200, { ok: true, job: job('succeeded') }));
    window.localStorage.setItem('cafe-pos.edge-token', 'edge-secret');
    const repository = new EdgePrintRepositoryImpl();

    const result = await repository.print({
      documentId: '11111111-1111-1111-1111-111111111111',
      operationId: 'pos:operation-1',
      copies: 1,
    });

    expect(result.status).toBe('succeeded');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:18181/v1/print-jobs',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          operationId: 'pos:operation-1',
          documentId: '11111111-1111-1111-1111-111111111111',
          copies: 1,
        }),
        headers: expect.objectContaining({ 'X-Edge-Token': 'edge-secret' }),
      }),
    );
  });

  it('accepts a queued job so Edge can retry it after connectivity returns', async () => {
    fetchMock.mockReturnValueOnce(response(202, { ok: true, job: job('queued') }));

    await expect(
      new EdgePrintRepositoryImpl().print({
        documentId: '11111111-1111-1111-1111-111111111111',
        operationId: 'pos:operation-1',
      }),
    ).resolves.toMatchObject({ status: 'queued' });
  });

  it('surfaces a terminal Edge failure instead of opening a browser print fallback', async () => {
    fetchMock.mockReturnValueOnce(response(422, { ok: false, job: job('failed') }));

    const error = await new EdgePrintRepositoryImpl()
      .print({
        documentId: '11111111-1111-1111-1111-111111111111',
        operationId: 'pos:operation-1',
      })
      .catch((caught) => caught);

    expect(error).toBeInstanceOf(EdgePrintError);
    expect(error).toMatchObject({ code: 'EDGE_REJECTED', message: 'printer offline' });
  });

  it('reports that local Edge is unavailable when the loopback request fails', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(
      new EdgePrintRepositoryImpl().print({
        documentId: '11111111-1111-1111-1111-111111111111',
        operationId: 'pos:operation-1',
      }),
    ).rejects.toMatchObject({ code: 'EDGE_UNAVAILABLE' });
  });

  it('routes remote mode printing through backend websocket delivery', async () => {
    persistTransportConnection({ mode: 'remote', restaurantId: 'restaurant-1' });
    apiPostMock.mockResolvedValueOnce({ ok: true, job: job('succeeded') });

    await expect(
      new EdgePrintRepositoryImpl().print({
        documentId: '11111111-1111-1111-1111-111111111111',
        operationId: 'pos:operation-1',
      }),
    ).resolves.toMatchObject({ status: 'succeeded' });

    expect(apiPostMock).toHaveBeenCalledWith('/pos/printing/jobs/', {
      operationId: 'pos:operation-1',
      documentId: '11111111-1111-1111-1111-111111111111',
      copies: 1,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
