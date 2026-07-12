export type EdgePrintJobStatus = 'queued' | 'rendering' | 'dispatched' | 'succeeded' | 'failed' | 'dispatch_unknown';

export type EdgePrintIntent = {
  documentId: string;
  operationId?: string;
  copies?: number;
};

export type EdgePrintJob = {
  operationId: string;
  documentId: string;
  copies: number;
  status: EdgePrintJobStatus;
  attempts: number;
  lastError?: string;
  result?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export class EdgePrintError extends Error {
  constructor(
    message: string,
    public readonly code: 'EDGE_UNAVAILABLE' | 'EDGE_REJECTED' | 'EDGE_DISPATCH_UNKNOWN',
    public readonly job?: EdgePrintJob,
  ) {
    super(message);
    this.name = 'EdgePrintError';
  }
}
