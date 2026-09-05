import { useEffect, useMemo, useState } from 'react';

import type { PaymentMethod } from 'modules/cashier/domain';

export type SplitPaymentPart = {
  id: string;
  method: 'cash' | 'card';
  amount: string;
  status?: 'paid';
};

type Options = {
  remainingTotal: number;
  enabledMethods?: string[];
  cashLabel: string;
  cardLabel: string;
};

export function usePaymentEditorState({ remainingTotal, enabledMethods, cashLabel, cardLabel }: Options) {
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [amount, setAmount] = useState('0');
  const [splitParts, setSplitParts] = useState<SplitPaymentPart[] | null>(null);

  useEffect(() => {
    if (remainingTotal > 0 && !splitParts) {
      setAmount(String(remainingTotal));
    }
  }, [remainingTotal, splitParts]);

  const paymentOptions = useMemo(
    () =>
      (enabledMethods ?? ['cash', 'card'])
        .filter((value): value is PaymentMethod => value === 'cash' || value === 'card')
        .map((value) => ({ value, label: value === 'cash' ? cashLabel : cardLabel })),
    [cardLabel, cashLabel, enabledMethods],
  );

  useEffect(() => {
    if (paymentOptions.length && !paymentOptions.some((option) => option.value === method)) {
      setMethod(paymentOptions[0].value);
    }
  }, [method, paymentOptions]);

  const paymentAmount = Number(amount || 0);
  const splitTotal = useMemo(
    () => (splitParts ?? []).reduce((sum, part) => sum + Number(part.amount || 0), 0),
    [splitParts],
  );
  const pendingSplitParts = useMemo(() => (splitParts ?? []).filter((part) => part.status !== 'paid'), [splitParts]);
  const pendingSplitTotal = useMemo(
    () => pendingSplitParts.reduce((sum, part) => sum + Number(part.amount || 0), 0),
    [pendingSplitParts],
  );
  const hasZeroSplitAmount = pendingSplitParts.some((part) => Number(part.amount || 0) <= 0);
  const isPaymentAmountValid = Number.isSafeInteger(paymentAmount) && paymentAmount > 0;
  const isSplitPaymentValid =
    !splitParts ||
    (splitParts.length >= 2 &&
      !hasZeroSplitAmount &&
      pendingSplitParts.every((part) => Number.isSafeInteger(Number(part.amount))) &&
      pendingSplitTotal > 0 &&
      splitTotal === paymentAmount);

  const createInitialSplitParts = () => {
    const defaultPartMethod = method === 'card' ? 'card' : 'cash';
    if (splitParts) {
      setSplitParts((parts) => [...(parts ?? []), { id: `${Date.now()}`, method: defaultPartMethod, amount: '0' }]);
      return;
    }

    const firstAmount = Math.floor(paymentAmount / 2);
    setSplitParts([
      { id: `${Date.now()}-1`, method: defaultPartMethod, amount: String(firstAmount) },
      { id: `${Date.now()}-2`, method: defaultPartMethod, amount: String(Math.max(paymentAmount - firstAmount, 0)) },
    ]);
  };

  const updateSplitPart = (id: string, changes: Partial<SplitPaymentPart>) => {
    setSplitParts((parts) => parts?.map((part) => (part.id === id ? { ...part, ...changes } : part)) ?? null);
  };

  const removeSplitPart = (id: string) => {
    setSplitParts((parts) => {
      if (!parts || parts.length <= 2) {
        return parts?.some((part) => part.status === 'paid') ? parts : null;
      }
      if (parts.find((part) => part.id === id)?.status === 'paid') {
        return parts;
      }
      return parts.filter((part) => part.id !== id);
    });
  };

  const selectMethod = (value: PaymentMethod) => {
    setMethod(value);
    setSplitParts(null);
  };

  return {
    method,
    amount,
    splitParts,
    paymentOptions,
    paymentAmount,
    splitTotal,
    pendingSplitTotal,
    hasZeroSplitAmount,
    isPaymentAmountValid,
    isSplitPaymentValid,
    setAmount,
    setSplitParts,
    selectMethod,
    createInitialSplitParts,
    updateSplitPart,
    removeSplitPart,
  };
}
