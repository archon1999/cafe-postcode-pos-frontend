// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { persistTransportConnection } from 'shared/api/edgeConnection';

import { EdgePrintError } from '../../domain';

import { EdgePrintRepositoryImpl } from './edge-print.repository.impl';

const { apiPostMock } = vi.hoisted(() => ({ apiPostMock: vi.fn() }));

vi.mock('shared/api/client', () => ({
  apiGet: vi.fn(),
  apiPost: (...args: unknown[]) => apiPostMock(...args),
}));

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

describe('EdgePrintRepositoryImpl', () => {
  beforeEach(() => {
    window.localStorage.clear();
    apiPostMock.mockReset();
  });

  it('submits only a document id, operation id and copies through the secured local API client', async () => {
    apiPostMock.mockResolvedValueOnce({ ok: true, job: job('succeeded') });
    const repository = new EdgePrintRepositoryImpl();

    const result = await repository.print({
      documentId: '11111111-1111-1111-1111-111111111111',
      operationId: 'pos:operation-1',
      copies: 1,
    });

    expect(result.status).toBe('succeeded');
    expect(apiPostMock).toHaveBeenCalledWith(
      '/print-jobs',
      {
        operationId: 'pos:operation-1',
        documentId: '11111111-1111-1111-1111-111111111111',
        copies: 1,
      },
      { timeout: 15_000 },
    );
  });

  it('accepts a queued job so Edge can retry it after connectivity returns', async () => {
    apiPostMock.mockResolvedValueOnce({ ok: true, job: job('queued') });

    await expect(
      new EdgePrintRepositoryImpl().print({
        documentId: '11111111-1111-1111-1111-111111111111',
        operationId: 'pos:operation-1',
      }),
    ).resolves.toMatchObject({ status: 'queued' });
  });

  it('surfaces a terminal Edge failure instead of opening a browser print fallback', async () => {
    apiPostMock.mockResolvedValueOnce({ ok: false, job: job('failed') });

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
    apiPostMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));

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
    expect(apiPostMock).toHaveBeenCalledTimes(1);
  });
});
