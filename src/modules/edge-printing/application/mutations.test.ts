import { beforeEach, describe, expect, it, vi } from 'vitest';

const printMock = vi.hoisted(() => vi.fn());

vi.mock('../data-access', () => ({
  edgePrintRepository: { print: printMock },
}));

import { enqueueEdgePrintDocuments, enqueueEdgeReprintDocuments } from './mutations';

describe('edge print application mutations', () => {
  beforeEach(() => {
    printMock.mockReset();
    printMock.mockImplementation(async (intent) => ({
      operationId: intent.operationId ?? `generated:${printMock.mock.calls.length}`,
      documentId: intent.documentId,
      status: 'queued',
    }));
  });

  it('keeps automatic printing idempotent for a document', async () => {
    await enqueueEdgePrintDocuments(['document-1', 'document-1']);

    expect(printMock).toHaveBeenCalledTimes(1);
    expect(printMock).toHaveBeenCalledWith({ documentId: 'document-1', operationId: 'auto:document-1' });
  });

  it('lets each manual reprint create a new operation', async () => {
    await enqueueEdgeReprintDocuments(['document-1']);
    await enqueueEdgeReprintDocuments(['document-1']);

    expect(printMock).toHaveBeenCalledTimes(2);
    expect(printMock).toHaveBeenNthCalledWith(1, { documentId: 'document-1' });
    expect(printMock).toHaveBeenNthCalledWith(2, { documentId: 'document-1' });
  });
});
