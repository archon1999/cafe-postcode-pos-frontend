import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';

import { useCashierPaymentMutation } from 'modules/cashier/application';
import type { CashierPaymentResponse, PaymentMethod } from 'modules/cashier/domain';

import { getMartaNon2xxDebugJson, getMutationErrorDetail } from './payment-error-debug';
import type { SplitPaymentPart } from './usePaymentEditorState';

type PaymentCommand = {
  method: PaymentMethod;
  amount: number;
  registerFiscal: boolean;
  manualCardOverride?: boolean;
  manualCardReason?: string;
  finalTotal?: number;
  totalOverrideReason?: string;
};

type Options = {
  amount: string;
  method: PaymentMethod;
  orderId: string | null;
  paymentAmount: number;
  paymentFailedMessage: string;
  splitParts: SplitPaymentPart[] | null;
  finalTotal?: number;
  totalOverrideReason?: string;
  onPaymentComplete: (response: CashierPaymentResponse, paidAmount: number) => void;
  onManualPaymentComplete: (response: CashierPaymentResponse) => void;
  setAmount: (value: string) => void;
  setSplitParts: Dispatch<SetStateAction<SplitPaymentPart[] | null>>;
};

export function usePaymentSubmission({
  amount,
  method,
  orderId,
  paymentAmount,
  paymentFailedMessage,
  splitParts,
  finalTotal,
  totalOverrideReason,
  onPaymentComplete,
  onManualPaymentComplete,
  setAmount,
  setSplitParts,
}: Options) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingRegisterFiscal, setPendingRegisterFiscal] = useState(true);
  const [errorToastOpen, setErrorToastOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [cardFailureOpen, setCardFailureOpen] = useState(false);
  const [cardFailureMessage, setCardFailureMessage] = useState('');
  const [cardFailureDebugJson, setCardFailureDebugJson] = useState('');

  const usesCard = method === 'card' || splitParts?.some((part) => part.method === 'card');

  const reportError = (error: unknown, fallback = paymentFailedMessage, showCardFailure = false) => {
    const detail = getMutationErrorDetail(error) || fallback;
    setErrorMessage(detail);
    setErrorToastOpen(true);
    if (showCardFailure && usesCard) {
      setCardFailureMessage(detail);
      setCardFailureDebugJson(getMartaNon2xxDebugJson(error));
      setCardFailureOpen(true);
    }
  };

  const paymentMutation = useCashierPaymentMutation({
    orderId,
    onPrintError: (error) => reportError(error, "Oshxona chekini chiqarib bo'lmadi."),
  });
  const executePayment = (command: PaymentCommand) => paymentMutation.mutateAsync(command);

  useEffect(() => {
    if (paymentMutation.isError) {
      reportError(paymentMutation.error, paymentFailedMessage, true);
    }
    // Mutation state is the trigger; the other values describe that state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentMutation.isError, paymentMutation.error]);

  const submitSplitPayment = async (registerFiscal: boolean) => {
    if (!splitParts) return;
    const parts = splitParts.map((part) => ({ ...part, amount: Number(part.amount || 0) }));
    const payableParts = parts.filter((part) => part.status !== 'paid');
    const paidPartIds = new Set(parts.filter((part) => part.status === 'paid').map((part) => part.id));
    const canApplyTotalOverride = paidPartIds.size === 0;
    let latestResponse: CashierPaymentResponse | null = null;
    let paidAmount = 0;

    for (const [index, part] of payableParts.entries()) {
      try {
        latestResponse = await executePayment({
          method: part.method,
          amount: part.amount,
          registerFiscal,
          ...(canApplyTotalOverride && index === 0 && finalTotal !== undefined
            ? { finalTotal, totalOverrideReason }
            : {}),
        });
        paidAmount += part.amount;
        paidPartIds.add(part.id);
      } catch (error) {
        const preservedParts = parts.map((currentPart) => ({
          ...currentPart,
          amount: String(currentPart.amount),
          ...(paidPartIds.has(currentPart.id) ? { status: 'paid' as const } : {}),
        }));
        setSplitParts(preservedParts);
        setAmount(String(preservedParts.reduce((sum, part) => sum + Number(part.amount || 0), 0)));
        throw error;
      }
    }

    if (latestResponse) onPaymentComplete(latestResponse, paidAmount);
  };

  const submitPayment = async (registerFiscal: boolean) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setPendingRegisterFiscal(registerFiscal);
    try {
      if (splitParts) {
        await submitSplitPayment(registerFiscal);
      } else {
        const response = await executePayment({
          method,
          amount: paymentAmount,
          registerFiscal,
          ...(finalTotal !== undefined ? { finalTotal, totalOverrideReason } : {}),
        });
        onPaymentComplete(response, paymentAmount);
      }
    } catch (error) {
      reportError(error, paymentFailedMessage, true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const completeCardManually = async () => {
    if (method !== 'card' || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const response = await executePayment({
        method: 'card',
        amount: Number(amount || 0),
        registerFiscal: pendingRegisterFiscal,
        manualCardOverride: true,
        manualCardReason: cardFailureMessage,
        ...(finalTotal !== undefined ? { finalTotal, totalOverrideReason } : {}),
      });
      setCardFailureOpen(false);
      onManualPaymentComplete(response);
    } catch (error) {
      reportError(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyCardFailureDebug = async () => {
    if (cardFailureDebugJson) await navigator.clipboard?.writeText(cardFailureDebugJson);
  };

  return {
    cardFailureDebugJson,
    cardFailureMessage,
    cardFailureOpen,
    closeCardFailure: () => setCardFailureOpen(false),
    completeCardManually,
    copyCardFailureDebug,
    errorMessage,
    errorToastOpen,
    isSubmitting,
    pendingRegisterFiscal,
    reportError,
    setErrorToastOpen,
    submitPayment,
  };
}
