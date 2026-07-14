import { useMutation } from '@tanstack/react-query';

import { edgePrintRepository } from '../data-access';
import type { EdgePrintIntent } from '../domain';

export function useEdgePrintMutation() {
  return useMutation({
    mutationFn: (intent: EdgePrintIntent) => edgePrintRepository.print(intent),
  });
}

export async function enqueueEdgePrintDocuments(documentIds: string[]) {
  const settled = await Promise.allSettled(
    [...new Set(documentIds.filter(Boolean))].map((documentId) => edgePrintRepository.print({ documentId })),
  );
  return {
    jobs: settled.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : [])),
    errors: settled.flatMap((result) => (result.status === 'rejected' ? [result.reason] : [])),
  };
}
