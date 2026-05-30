import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { queryClient } from 'shared/api/query-client';

import {
  createTemporaryBuilderId,
  deriveOptimisticBuilderOrder,
  findLatestOrderItem,
  type BuilderMenuItemLike,
  type BuilderOrderItemLike,
  type BuilderOrderLike,
  type PendingAddOperation,
  type PendingRemoveOperation,
} from './optimistic-builder-order';

type UseOptimisticBuilderOrderOptions<
  TMenuItem extends BuilderMenuItemLike,
  TItem extends BuilderOrderItemLike,
  TOrder extends BuilderOrderLike<TItem>,
  TCanonicalData,
> = {
  baseOrder?: TOrder;
  canonicalQueryKey: readonly unknown[];
  canonicalQueryFn: () => Promise<TCanonicalData>;
  channel: string;
  createOrder: (note: string) => Promise<string>;
  defaultServiceFeeEnabled?: boolean;
  defaultServiceFeePercent: number;
  defaultVatEnabled?: boolean;
  defaultVatPercent?: number | string;
  removeOrderItem: (itemId: string) => Promise<void>;
  selectCurrentOrder: (data: TCanonicalData) => TOrder | undefined;
  addOrderItem: (orderId: string, menuItem: TMenuItem, note: string) => Promise<void>;
  resetKey?: unknown;
  syncErrorMessage: string;
};

function createOperationId() {
  return createTemporaryBuilderId();
}

export function useOptimisticBuilderOrder<
  TMenuItem extends BuilderMenuItemLike,
  TItem extends BuilderOrderItemLike,
  TOrder extends BuilderOrderLike<TItem>,
  TCanonicalData,
>(options: UseOptimisticBuilderOrderOptions<TMenuItem, TItem, TOrder, TCanonicalData>) {
  const {
    baseOrder,
    canonicalQueryFn,
    canonicalQueryKey,
    channel,
    createOrder,
    defaultServiceFeeEnabled,
    defaultServiceFeePercent,
    defaultVatEnabled,
    defaultVatPercent,
    removeOrderItem,
    resetKey,
    selectCurrentOrder,
    addOrderItem,
    syncErrorMessage,
  } = options;
  const [resolvedBaseOrder, setResolvedBaseOrder] = useState<TOrder | undefined>(baseOrder);
  const [pendingAdds, setPendingAdds] = useState<PendingAddOperation<TMenuItem>[]>([]);
  const [pendingRemoves, setPendingRemoves] = useState<PendingRemoveOperation[]>([]);

  const pendingAddsRef = useRef(pendingAdds);
  const pendingRemovesRef = useRef(pendingRemoves);
  const tempOrderIdRef = useRef<string | null>(null);
  const resolvedOrderIdRef = useRef<string | null>(baseOrder?.id ?? null);
  const queueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    pendingAddsRef.current = pendingAdds;
  }, [pendingAdds]);

  useEffect(() => {
    pendingRemovesRef.current = pendingRemoves;
  }, [pendingRemoves]);

  useEffect(() => {
    setResolvedBaseOrder(baseOrder);
    resolvedOrderIdRef.current = baseOrder?.id ?? null;
    tempOrderIdRef.current = null;
  }, [baseOrder, resetKey]);

  const settleAddOperation = useCallback((opId: string) => {
    setPendingAdds((current) => current.filter((operation) => operation.opId !== opId));
  }, []);

  const settleRemoveOperation = useCallback((opId: string) => {
    setPendingRemoves((current) => current.filter((operation) => operation.opId !== opId));
  }, []);

  const markAddOperationCanceled = useCallback((tempItemId: string) => {
    setPendingAdds((current) =>
      current.map((operation) => (operation.tempItemId === tempItemId ? { ...operation, canceled: true } : operation)),
    );
  }, []);

  const getPendingAddById = useCallback((opId: string) => {
    return pendingAddsRef.current.find((operation) => operation.opId === opId);
  }, []);

  const refreshCurrentOrder = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: canonicalQueryKey });
    const data = await queryClient.fetchQuery({
      queryKey: canonicalQueryKey,
      queryFn: canonicalQueryFn,
    });
    const currentOrder = selectCurrentOrder(data);

    setResolvedBaseOrder(currentOrder);
    return currentOrder;
  }, [canonicalQueryFn, canonicalQueryKey, selectCurrentOrder]);

  const enqueue = useCallback((task: () => Promise<void>) => {
    queueRef.current = queueRef.current.then(task).catch(() => undefined);
  }, []);

  const runAddOperation = useCallback(
    async (opId: string) => {
      const queuedOperation = getPendingAddById(opId);

      if (!queuedOperation) {
        return;
      }

      if (queuedOperation.canceled) {
        settleAddOperation(opId);
        return;
      }

      let createdOrderId: string | null = null;

      try {
        let orderId = resolvedOrderIdRef.current;

        if (!orderId) {
          orderId = await createOrder(queuedOperation.note);
          resolvedOrderIdRef.current = orderId;
          createdOrderId = orderId;
        }

        const operationBeforeAdd = getPendingAddById(opId);

        if (!operationBeforeAdd) {
          return;
        }

        if (operationBeforeAdd.canceled) {
          settleAddOperation(opId);
          return;
        }

        await addOrderItem(orderId, operationBeforeAdd.menuItem, operationBeforeAdd.note);

        const operationAfterAdd = getPendingAddById(opId);

        if (operationAfterAdd?.canceled) {
          const refreshedOrder = await refreshCurrentOrder();
          const createdItem = findLatestOrderItem(refreshedOrder?.items, {
            catalogItemId: operationAfterAdd.menuItem.id,
            note: operationAfterAdd.note,
          });

          if (createdItem) {
            await removeOrderItem(createdItem.id);
            await refreshCurrentOrder();
          }
        } else {
          await refreshCurrentOrder();
        }
      } catch {
        if (!createdOrderId || resolvedBaseOrder) {
          await refreshCurrentOrder().catch(() => undefined);
        }
        toast.error(syncErrorMessage);
      } finally {
        settleAddOperation(opId);
      }
    },
    [
      addOrderItem,
      createOrder,
      getPendingAddById,
      refreshCurrentOrder,
      removeOrderItem,
      resolvedBaseOrder,
      settleAddOperation,
      syncErrorMessage,
    ],
  );

  const runRemoveOperation = useCallback(
    async (operation: PendingRemoveOperation) => {
      try {
        await removeOrderItem(operation.itemId);
        await refreshCurrentOrder();
      } catch {
        await refreshCurrentOrder().catch(() => undefined);
        toast.error(syncErrorMessage);
      } finally {
        settleRemoveOperation(operation.opId);
      }
    },
    [refreshCurrentOrder, removeOrderItem, settleRemoveOperation, syncErrorMessage],
  );

  const addItem = useCallback(
    (menuItem: TMenuItem, note: string) => {
      const opId = createOperationId();
      const tempItemId = createOperationId();

      setPendingAdds((current) => [...current, { opId, tempItemId, menuItem, note, canceled: false }]);
      enqueue(() => runAddOperation(opId));
    },
    [enqueue, runAddOperation],
  );

  const removeItem = useCallback(
    (itemId: string) => {
      const pendingAdd = pendingAddsRef.current.find((operation) => operation.tempItemId === itemId);

      if (pendingAdd) {
        markAddOperationCanceled(itemId);
        return;
      }

      if (pendingRemovesRef.current.some((operation) => operation.itemId === itemId)) {
        return;
      }

      const operation = { opId: createOperationId(), itemId };
      pendingRemovesRef.current = [...pendingRemovesRef.current, operation];
      setPendingRemoves((current) => [...current, operation]);
      enqueue(() => runRemoveOperation(operation));
    },
    [enqueue, markAddOperationCanceled, runRemoveOperation],
  );

  const optimisticOrder = useMemo(() => {
    if (!resolvedBaseOrder && pendingAdds.some((operation) => !operation.canceled) && !tempOrderIdRef.current) {
      tempOrderIdRef.current = createTemporaryBuilderId();
    }

    const derivedOrder = deriveOptimisticBuilderOrder<TMenuItem, TItem, TOrder>({
      baseOrder: resolvedBaseOrder,
      channel,
      defaultServiceFeeEnabled,
      defaultServiceFeePercent,
      defaultVatEnabled,
      defaultVatPercent,
      pendingAdds,
      pendingRemoves,
      tempOrderId: tempOrderIdRef.current,
    });

    if (!derivedOrder) {
      tempOrderIdRef.current = null;
    }

    return derivedOrder;
  }, [
    channel,
    defaultServiceFeeEnabled,
    defaultServiceFeePercent,
    defaultVatEnabled,
    defaultVatPercent,
    pendingAdds,
    pendingRemoves,
    resolvedBaseOrder,
  ]);

  return {
    addItem,
    currentOrder: optimisticOrder,
    hasPendingOperations: pendingAdds.length > 0 || pendingRemoves.length > 0,
    removeItem,
  };
}
