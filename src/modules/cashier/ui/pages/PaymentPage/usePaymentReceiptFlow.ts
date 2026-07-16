import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';

import type { CashierPaymentResponse } from 'modules/cashier/domain';

export function usePaymentReceiptFlow({
  afterPaymentPath,
  remainingTotal,
  clearSplitParts,
  onPrintDocument,
  onPrintError,
  setAmount,
}: {
  afterPaymentPath: string;
  remainingTotal: number;
  clearSplitParts: () => void;
  onPrintDocument: (documentId: string) => Promise<unknown>;
  onPrintError: (message: string) => void;
  setAmount: (amount: string) => void;
}) {
  const navigate = useNavigate();
  const [receiptData, setReceiptData] = useState<CashierPaymentResponse | null>(null);
  const [printToastOpen, setPrintToastOpen] = useState(false);
  const [receiptPrintPromptOpen, setReceiptPrintPromptOpen] = useState(false);
  const [isReceiptPrintConfirming, setIsReceiptPrintConfirming] = useState(false);
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
      setReceiptData(response);
      return;
    }

    setAmount(String(Math.max(remainingTotal - paidAmount, 0)));
    clearSplitParts();
  };

  const printAndFinish = async () => {
    if (isReceiptPrintConfirming) {
      return;
    }

    setIsReceiptPrintConfirming(true);
    try {
      const documents = receipts.flatMap((receipt) => (receipt?.printDocument ? [receipt.printDocument] : []));
      if (documents.length === 0) {
        throw new Error('Chek uchun print hujjati tayyor emas.');
      }
      await Promise.all(documents.map(onPrintDocument));
      setPrintToastOpen(true);
    } catch (error) {
      onPrintError(error instanceof Error ? error.message : "Chekni chiqarib bo'lmadi.");
    } finally {
      setIsReceiptPrintConfirming(false);
      finish();
    }
  };

  return {
    receiptData,
    setReceiptData,
    printToastOpen,
    setPrintToastOpen,
    receiptPrintPromptOpen,
    setReceiptPrintPromptOpen,
    isReceiptPrintConfirming,
    finishReceiptFlow: finish,
    handleSuccessfulPaymentResponse: handleSuccessfulPayment,
    handleReceiptPromptPrint: printAndFinish,
  };
}
