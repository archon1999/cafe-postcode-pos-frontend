import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';

import { useCashierFiscalRetryMutation } from 'modules/cashier/application';
import type { CashierPaymentResponse } from 'modules/cashier/domain';
import { getApiErrorMessage } from 'shared/api/errorMessage';

export function usePaymentReceiptFlow({
  afterPaymentPath,
  successMessage,
  remainingTotal,
  clearSplitParts,
  onPrintDocuments,
  onPrintError,
  setAmount,
}: {
  afterPaymentPath: string;
  successMessage: string;
  remainingTotal: number;
  clearSplitParts: () => void;
  onPrintDocuments: (documentIds: string[]) => void;
  onPrintError: (message: string) => void;
  setAmount: (amount: string) => void;
}) {
  const navigate = useNavigate();
  const [receiptData, setReceiptData] = useState<CashierPaymentResponse | null>(null);
  const [printToastOpen, setPrintToastOpen] = useState(false);
  const [receiptPrintPromptOpen, setReceiptPrintPromptOpen] = useState(false);
  const fiscalRetry = useCashierFiscalRetryMutation({
    onSuccess: (response) => {
      if (receiptData) {
        handleSuccessfulPayment({ ...receiptData, receipt: response.receipt, receipts: response.receipts }, 0);
      }
    },
    onError: (error) => onPrintError(getApiErrorMessage(error, 'Fiskal chek holatini tekshirib bo‘lmadi.')),
  });
  const receipts = useMemo(
    () => receiptData?.receipts?.filter(Boolean) ?? (receiptData?.receipt ? [receiptData.receipt] : []),
    [receiptData?.receipt, receiptData?.receipts],
  );

  const finish = () => {
    setReceiptPrintPromptOpen(false);
    setReceiptData(null);
    void navigate(afterPaymentPath, { replace: true });
  };

  const handleSuccessfulPayment = (response: CashierPaymentResponse, paidAmount: number) => {
    if (response.receipt || response.receipts?.length || response.order.status === 'closed') {
      const paymentReceipts = (
        response.receipts?.length ? response.receipts : response.receipt ? [response.receipt] : []
      ).filter((receipt) => receipt !== null);
      const needsAttention = paymentReceipts.some(
        (receipt) =>
          ['failed', 'unknown', 'registering'].includes(receipt.status ?? '') ||
          ['failed', 'unknown', 'pending'].includes(receipt.fiscalState ?? ''),
      );
      if (needsAttention) {
        setReceiptData(response);
        return;
      }
      const documentIds = paymentReceipts.flatMap((receipt) => (receipt.printDocument ? [receipt.printDocument] : []));
      if (documentIds.length > 0) {
        onPrintDocuments(documentIds);
      } else if (paymentReceipts.length > 0) {
        onPrintError('Chek uchun print hujjati tayyor emas.');
      }
      toast.success(successMessage);
      finish();
      return;
    }

    setAmount(String(Math.max(remainingTotal - paidAmount, 0)));
    clearSplitParts();
  };

  const printAndFinish = () => {
    const documents = receipts.flatMap((receipt) => (receipt?.printDocument ? [receipt.printDocument] : []));
    if (documents.length === 0) {
      onPrintError('Chek uchun print hujjati tayyor emas.');
      finish();
      return;
    }
    onPrintDocuments(documents);
    setPrintToastOpen(true);
    finish();
  };

  return {
    receiptData,
    setReceiptData,
    printToastOpen,
    setPrintToastOpen,
    receiptPrintPromptOpen,
    setReceiptPrintPromptOpen,
    isReceiptPrintConfirming: false,
    isFiscalRetrying: fiscalRetry.isPending,
    retryFiscalReceipt: () => {
      if (receiptData?.payment.id && !fiscalRetry.isPending) fiscalRetry.mutate(receiptData.payment.id);
    },
    finishReceiptFlow: finish,
    handleSuccessfulPaymentResponse: handleSuccessfulPayment,
    handleReceiptPromptPrint: printAndFinish,
  };
}
