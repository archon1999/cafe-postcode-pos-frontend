import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';

import { useCashierPaymentMutation, useRecoverCashierPaymentMutation } from 'modules/cashier/application';
import {
  getPaymentFailureState,
  type CashierPaymentResponse,
  type PaymentFailureState,
  type PaymentMethod,
} from 'modules/cashier/domain';
import type { PosServiceFeeQuote } from 'shared/pos/service-fees';

import { getMartaNon2xxDebugJson, getMutationErrorDetail } from './payment-error-debug';
import type { SplitPaymentPart } from './usePaymentEditorState';

type PaymentCommand = {
  method: PaymentMethod;
  amount: number;
  registerFiscal: boolean;
  manualCardOverride?: boolean;
  manualCardReason?: string;
  finalTotal?: number;
  serviceFeeQuote?: PosServiceFeeQuote | null;
};

type FailedPaymentAttempt = PaymentCommand & {
  splitPartId?: string;
};

type PaymentFailure = {
  attempt: FailedPaymentAttempt;
  error: unknown;
};

type Options = {
  method: PaymentMethod;
  orderId: string | null;
  paymentAmount: number;
  paymentFailedMessage: string;
  splitParts: SplitPaymentPart[] | null;
  finalTotal?: number;
  serviceFeeQuote?: PosServiceFeeQuote | null;
  onQuoteStale?: () => void | Promise<void>;
  onPaymentComplete: (response: CashierPaymentResponse, paidAmount: number) => void;
  setAmount: (value: string) => void;
  setSplitParts: Dispatch<SetStateAction<SplitPaymentPart[] | null>>;
};

export function usePaymentSubmission({
  method,
  orderId,
  paymentAmount,
  paymentFailedMessage,
  splitParts,
  finalTotal,
  serviceFeeQuote,
  onQuoteStale,
  onPaymentComplete,
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
  const [failedPaymentAttempt, setFailedPaymentAttempt] = useState<FailedPaymentAttempt | null>(null);
  const [failureState, setFailureState] = useState<PaymentFailureState | null>(null);
  const submitting = useRef(false);
  const recoveredOrder = useRef<string | null>(null);
  const recoverMutation = useRecoverCashierPaymentMutation(orderId);

  const isServiceFeeQuoteStale = (error: unknown) => {
    const responseData = (error as { response?: { data?: { code?: string } } })?.response?.data;
    return responseData?.code === 'SERVICE_FEE_QUOTE_STALE';
  };

  const reportError = (error: unknown, fallback = paymentFailedMessage, failedAttempt?: FailedPaymentAttempt) => {
    if (isServiceFeeQuoteStale(error)) {
      void onQuoteStale?.();
      setErrorMessage('Xizmat haqi yangilandi. Yangi summani qayta tasdiqlang.');
      setErrorToastOpen(true);
      setCardFailureOpen(false);
      setFailedPaymentAttempt(null);
      return;
    }
    const detail = getMutationErrorDetail(error) || fallback;
    setErrorMessage(detail);
    setErrorToastOpen(true);
    const financialFailure = getPaymentFailureState(error);
    if (failedAttempt || financialFailure.commandId) {
      setFailureState(financialFailure);
      setCardFailureMessage(detail);
      setCardFailureDebugJson(getMartaNon2xxDebugJson(error));
      if (failedAttempt) setFailedPaymentAttempt(failedAttempt);
      setCardFailureOpen(true);
    }
  };

  const paymentMutation = useCashierPaymentMutation({
    orderId,
    onPrintError: (error) => reportError(error, "Oshxona chekini chiqarib bo'lmadi."),
  });
  const executePayment = (command: PaymentCommand) => paymentMutation.mutateAsync(command);

  useEffect(() => {
    if (!orderId || recoveredOrder.current === orderId) return;
    recoveredOrder.current = orderId;
    void recoverMutation
      .mutateAsync(false)
      .then((response) => {
        if (response) onPaymentComplete(response, Number(response.payment.amount));
      })
      .catch((error: unknown) => {
        const original = (error as { response?: { data?: { originalCommand?: FailedPaymentAttempt } } })?.response?.data
          ?.originalCommand;
        reportError(error, paymentFailedMessage, original);
      });
    // Recover once per order. Query polling and receipt state updates must not re-run a financial recovery.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  useEffect(() => {
    if (paymentMutation.isError) {
      reportError(paymentMutation.error, paymentFailedMessage);
    }
    // Mutation state is the trigger; the other values describe that state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentMutation.isError, paymentMutation.error]);

  const submitSplitPayment = async (registerFiscal: boolean): Promise<PaymentFailure | null> => {
    if (!splitParts) return null;
    const parts = splitParts.map((part) => ({ ...part, amount: Number(part.amount || 0) }));
    const payableParts = parts.filter((part) => part.status !== 'paid');
    const paidPartIds = new Set(parts.filter((part) => part.status === 'paid').map((part) => part.id));
    const canApplyTotalOverride = paidPartIds.size === 0;
    let latestResponse: CashierPaymentResponse | null = null;
    let paidAmount = 0;

    for (const [index, part] of payableParts.entries()) {
      const command: PaymentCommand = {
        method: part.method,
        amount: part.amount,
        registerFiscal,
        serviceFeeQuote,
        ...(canApplyTotalOverride && index === 0 && finalTotal !== undefined ? { finalTotal } : {}),
      };
      try {
        latestResponse = await executePayment(command);
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
        return { attempt: { ...command, splitPartId: part.id }, error };
      }
    }

    if (latestResponse) onPaymentComplete(latestResponse, paidAmount);
    return null;
  };

  const submitPayment = async (registerFiscal: boolean) => {
    if (submitting.current) return;
    submitting.current = true;
    setIsSubmitting(true);
    setPendingRegisterFiscal(registerFiscal);
    setFailedPaymentAttempt(null);
    try {
      if (splitParts) {
        const failure = await submitSplitPayment(registerFiscal);
        if (failure) reportError(failure.error, paymentFailedMessage, failure.attempt);
      } else {
        const command: FailedPaymentAttempt = {
          method,
          amount: paymentAmount,
          registerFiscal,
          serviceFeeQuote,
          ...(finalTotal !== undefined ? { finalTotal } : {}),
        };
        try {
          const response = await executePayment(command);
          onPaymentComplete(response, paymentAmount);
        } catch (error) {
          reportError(error, paymentFailedMessage, command);
        }
      }
    } catch (error) {
      reportError(error, paymentFailedMessage);
    } finally {
      submitting.current = false;
      setIsSubmitting(false);
    }
  };

  const completeCardManually = async () => {
    const attempt = failedPaymentAttempt;
    if (attempt?.method !== 'card' || submitting.current || !failureState?.manualConfirmationAllowed) return;
    submitting.current = true;
    setIsSubmitting(true);
    try {
      const response = await executePayment({
        method: 'card',
        amount: attempt.amount,
        registerFiscal: attempt.registerFiscal,
        manualCardOverride: true,
        manualCardReason: cardFailureMessage,
        serviceFeeQuote: attempt.serviceFeeQuote,
        ...(attempt.finalTotal !== undefined ? { finalTotal: attempt.finalTotal } : {}),
      });
      let hasPendingSplitParts = false;
      if (attempt.splitPartId) {
        hasPendingSplitParts = Boolean(
          splitParts?.some((part) => part.id !== attempt.splitPartId && part.status !== 'paid'),
        );
        setSplitParts(
          (parts) =>
            parts?.map((part) => (part.id === attempt.splitPartId ? { ...part, status: 'paid' as const } : part)) ??
            null,
        );
      }
      setCardFailureOpen(false);
      setFailedPaymentAttempt(null);
      if (!hasPendingSplitParts) {
        onPaymentComplete(response, attempt.amount);
      }
    } catch (error) {
      reportError(error, paymentFailedMessage, attempt);
    } finally {
      submitting.current = false;
      setIsSubmitting(false);
    }
  };

  const copyCardFailureDebug = async () => {
    if (cardFailureDebugJson) await navigator.clipboard?.writeText(cardFailureDebugJson);
  };

  const retryPayment = async () => {
    if (submitting.current) return;
    const attempt = failedPaymentAttempt;
    submitting.current = true;
    setIsSubmitting(true);
    try {
      const command = attempt
        ? {
            method: attempt.method,
            amount: attempt.amount,
            registerFiscal: attempt.registerFiscal,
            serviceFeeQuote: attempt.serviceFeeQuote,
            ...(attempt.finalTotal !== undefined ? { finalTotal: attempt.finalTotal } : {}),
          }
        : null;
      const response =
        failureState?.state === 'unknown'
          ? await recoverMutation.mutateAsync(true)
          : command
            ? await executePayment(command)
            : null;
      if (response) {
        setCardFailureOpen(false);
        setFailedPaymentAttempt(null);
        setFailureState(null);
        if (attempt?.splitPartId) {
          const pending = splitParts?.some((part) => part.id !== attempt.splitPartId && part.status !== 'paid');
          setSplitParts(
            (parts) =>
              parts?.map((part) => (part.id === attempt.splitPartId ? { ...part, status: 'paid' } : part)) ?? null,
          );
          if (pending) return;
        }
        onPaymentComplete(response, Number(response.payment.amount));
      } else {
        setCardFailureMessage(
          'Saqlangan amal topilmadi. Buyurtma holatini yangilang va administrator bilan tekshiring.',
        );
      }
    } catch (error) {
      reportError(error, paymentFailedMessage, attempt ?? undefined);
    } finally {
      submitting.current = false;
      setIsSubmitting(false);
    }
  };

  return {
    cardFailureDebugJson,
    cardFailureMethod: failedPaymentAttempt?.method ?? null,
    cardFailureMessage,
    cardFailureOpen,
    failureState,
    closeCardFailure: () => {
      setCardFailureOpen(false);
      setFailedPaymentAttempt(null);
    },
    completeCardManually,
    retryPayment,
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
