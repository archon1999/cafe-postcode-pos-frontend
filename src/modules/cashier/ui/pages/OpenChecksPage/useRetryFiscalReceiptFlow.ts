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
  printDocument: (documentId: string) => Promise<unknown>;
};

export function useRetryFiscalReceiptFlow({ copy, latestPayment, onFinished, printDocument }: Options) {
  const [dialog, setDialog] = useState<RetryFiscalReceiptDialogState | null>(null);
  const [printPromptOpen, setPrintPromptOpen] = useState(false);
  const [isPrintConfirming, setIsPrintConfirming] = useState(false);

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
      setDialog({
        receipts,
        receiptNumber:
          receipts
            .map((receipt) => receipt.payload?.receiptNumber)
            .filter(Boolean)
            .join(', ') ||
          latestPayment?.id ||
          '-',
        methodLabel:
          latestPayment?.method === 'card' ? copy.card : latestPayment?.method === 'qr' ? copy.qr : copy.cash,
        amount: Number(latestPayment?.amount ?? 0),
      });
      toast.success('Fiscal bilan yopildi');
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Fiscal bilan yopishda xatolik bor.')),
  });

  const finish = () => {
    setPrintPromptOpen(false);
    setDialog(null);
    onFinished();
  };

  const print = async () => {
    if (isPrintConfirming) return;
    setIsPrintConfirming(true);
    try {
      const printableReceipts = (dialog?.receipts ?? []).filter((receipt) => receipt.printDocument);
      if (printableReceipts.length === 0) {
        throw new Error('Chek uchun print hujjati tayyor emas');
      }
      await Promise.all(printableReceipts.map((receipt) => printDocument(receipt.printDocument!)));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Chekni chiqarib bo‘lmadi');
    } finally {
      setIsPrintConfirming(false);
      finish();
    }
  };

  return {
    close: () => setDialog(null),
    dialog,
    finish,
    isPrintConfirming,
    isRetrying: retryMutation.isPending,
    print,
    printPromptOpen,
    retry: (paymentId: string) => retryMutation.mutate(paymentId),
    setPrintPromptOpen,
  };
}
