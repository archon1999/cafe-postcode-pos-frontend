import { apiPost } from 'shared/api/client';
import { readEdgeOrigin, readEdgeToken, readTransportConnection } from 'shared/api/edgeConnection';

import { EdgePrintError, type EdgePrintIntent, type EdgePrintJob, type EdgePrintRepository } from '../../domain';

type EdgePrintResponse = { ok?: boolean; error?: string; job?: EdgePrintJob };

function createOperationId(documentId: string) {
  const randomId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `pos:${documentId}:${randomId}`;
}

async function edgeRequest(path: string, init?: RequestInit): Promise<EdgePrintResponse> {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), 15_000);
  const token = readEdgeToken();
  try {
    const response = await fetch(`${readEdgeOrigin()}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(token ? { 'X-Edge-Token': token } : {}),
        ...init?.headers,
      },
    });
    const body = (await response.json().catch(() => ({}))) as EdgePrintResponse;
    if (!response.ok && !body.job) {
      throw new EdgePrintError(body.error || `Local Edge HTTP ${response.status}`, 'EDGE_REJECTED');
    }
    return body;
  } catch (error) {
    if (error instanceof EdgePrintError) throw error;
    throw new EdgePrintError(
      error instanceof Error && error.name === 'AbortError'
        ? 'Local Edge javob berish vaqti tugadi.'
        : 'Local Edge bilan bog‘lanib bo‘lmadi.',
      'EDGE_UNAVAILABLE',
    );
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

export class EdgePrintRepositoryImpl implements EdgePrintRepository {
  async print(intent: EdgePrintIntent) {
    const operationId = intent.operationId || createOperationId(intent.documentId);
    const payload = { operationId, documentId: intent.documentId, copies: intent.copies ?? 1 };
    const response =
      readTransportConnection()?.mode === 'remote'
        ? await apiPost<EdgePrintResponse>('/pos/printing/jobs/', payload)
        : await edgeRequest('/v1/print-jobs', { method: 'POST', body: JSON.stringify(payload) });
    if (!response.job) {
      throw new EdgePrintError(response.error || 'Local Agent print job qaytarmadi.', 'EDGE_REJECTED');
    }
    return this.validateJob(response.job);
  }

  private validateJob(job: EdgePrintJob) {
    if (job.status === 'dispatch_unknown') {
      throw new EdgePrintError(job.lastError || 'Printerga yuborish natijasi noma’lum.', 'EDGE_DISPATCH_UNKNOWN', job);
    }
    if (job.status === 'failed') {
      throw new EdgePrintError(job.lastError || 'Chekni chiqarib bo‘lmadi.', 'EDGE_REJECTED', job);
    }
    return job;
  }

  async getJob(operationId: string) {
    if (readTransportConnection()?.mode === 'remote') {
      throw new EdgePrintError('Remote print job shu request ichida yakunlanadi.', 'EDGE_UNAVAILABLE');
    }
    const response = await edgeRequest(`/v1/print-jobs/${encodeURIComponent(operationId)}`);
    if (!response.job) throw new EdgePrintError(response.error || 'Print job topilmadi.', 'EDGE_REJECTED');
    return response.job;
  }
}

export const edgePrintRepository: EdgePrintRepository = new EdgePrintRepositoryImpl();
