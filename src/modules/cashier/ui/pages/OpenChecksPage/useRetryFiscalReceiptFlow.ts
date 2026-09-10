import { useState } from 'react';
import { toast } from 'sonner';

import { useCashierFiscalRetryMutation } from 'modules/cashier/application';
import type { CashierOrder } from 'modules/cashier/domain';
import { getApiErrorMessage } from 'shared/api/errorMessage';
import { getPosCopy } from 'shared/locale/copy';

import type { RetryFiscalReceipt, RetryFiscalReceiptDialogState } from './OpenChecksDialogs';

type Payment = NonNullable<CashierOrder['payments']>[number];

type Options = {
  copy: ReturnType<typeof getPosCopy>;
  latestPayment?: Payment;
  onFinished: () => void;
  printDocuments: (documentIds: string[]) => void;
};

export function useRetryFiscalReceiptFlow({ copy, onFinished, printDocuments }: Options) {
  const [dialog, setDialog] = useState<RetryFiscalReceiptDialogState | null>(null);
  const [printPromptOpen, setPrintPromptOpen] = useState(false);

  const retryMutation = useCashierFiscalRetryMutation({
    onSuccess: (response) => {
      const failedResult = (response.results ?? []).find((item) => item && item.ok === false);
      if (failedResult) {
        toast.error(String(failedResult.detail ?? failedResult.message ?? 'Fiscal bilan yopishda xatolik bor.'));
        return;
      }
      const receipts = (
        (response.receipts?.length
          ? response.receipts
          : response.receipt
            ? [response.receipt]
            : []) as RetryFiscalReceipt[]
      ).filter(Boolean);
      if (
        receipts.length === 0 ||
        receipts.some(
          (receipt) =>
            ['unknown', 'registering', 'created', 'failed'].includes(receipt.status ?? '') ||
            ['unknown', 'pending', 'failed'].includes(receipt.fiscalState ?? ''),
        )
      ) {
        toast.error(copy.fiscalReceiptUnknown);
        return;
      }
      const documentIds = receipts.flatMap((receipt) => (receipt.printDocument ? [receipt.printDocument] : []));
      if (documentIds.length > 0) {
        printDocuments(documentIds);
      } else {
        toast.error('Chek uchun print hujjati tayyor emas');
      }
      toast.success('Fiscal bilan yopildi');
      onFinished();
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Fiscal bilan yopishda xatolik bor.')),
  });

  const finish = () => {
    setPrintPromptOpen(false);
    setDialog(null);
    onFinished();
  };

  const print = () => {
    const documentIds = (dialog?.receipts ?? []).flatMap((receipt) =>
      receipt.printDocument ? [receipt.printDocument] : [],
    );
    if (documentIds.length === 0) {
      toast.error('Chek uchun print hujjati tayyor emas');
      finish();
      return;
    }
    printDocuments(documentIds);
    finish();
  };

  return {
    close: () => setDialog(null),
    dialog,
    finish,
    isPrintConfirming: false,
    isRetrying: retryMutation.isPending,
    print,
    printPromptOpen,
    retry: (paymentId: string) => retryMutation.mutate(paymentId),
    setPrintPromptOpen,
  };
}
