import { apiGet, apiPost } from 'shared/api/client';
import { readTransportConnection } from 'shared/api/edgeConnection';

import { EdgePrintError, type EdgePrintIntent, type EdgePrintJob, type EdgePrintRepository } from '../../domain';

type EdgePrintResponse = { ok?: boolean; error?: string; job?: EdgePrintJob };

function createOperationId(documentId: string) {
  const randomId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `pos:${documentId}:${randomId}`;
}

export class EdgePrintRepositoryImpl implements EdgePrintRepository {
  async print(intent: EdgePrintIntent) {
    const operationId = intent.operationId || createOperationId(intent.documentId);
    const payload = { operationId, documentId: intent.documentId, copies: intent.copies ?? 1 };
    const isRemote = readTransportConnection()?.mode === 'remote';
    let response: EdgePrintResponse;
    try {
      response = isRemote
        ? await apiPost<EdgePrintResponse>('/pos/printing/jobs/', payload)
        : await apiPost<EdgePrintResponse>('/print-jobs', payload, { timeout: 15_000 });
    } catch (error) {
      if (isRemote || error instanceof EdgePrintError) throw error;
      throw new EdgePrintError('Local Agent bilan bog\u2018lanib bo\u2018lmadi.', 'EDGE_UNAVAILABLE');
    }
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
    const response = await apiGet<EdgePrintResponse>(`/print-jobs/${encodeURIComponent(operationId)}`);
    if (!response.job) throw new EdgePrintError(response.error || 'Print job topilmadi.', 'EDGE_REJECTED');
    return response.job;
  }
}

export const edgePrintRepository: EdgePrintRepository = new EdgePrintRepositoryImpl();
