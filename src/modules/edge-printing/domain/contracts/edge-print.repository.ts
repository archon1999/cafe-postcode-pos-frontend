import type { EdgePrintIntent, EdgePrintJob } from '../entities';

export interface EdgePrintRepository {
  print(intent: EdgePrintIntent): Promise<EdgePrintJob>;
  getJob(operationId: string): Promise<EdgePrintJob>;
}
