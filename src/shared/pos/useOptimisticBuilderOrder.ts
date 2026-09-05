import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { queryClient } from 'shared/api/query-client';
import type { PosModifierSelection } from 'shared/pos/modifiers';
import { selectedModifierOptions } from 'shared/pos/modifiers';
import type { PosServiceFeeComponent } from 'shared/pos/service-fees';

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
  createOrder: () => Promise<string>;
  defaultServiceFeeEnabled?: boolean;
  defaultServiceFeePercent: number;
  defaultServiceFeeComponents?: PosServiceFeeComponent[];
  defaultServiceFeeStartedAt?: string | null;
  defaultVatEnabled?: boolean;
  defaultVatPercent?: number | string;
  removeOrderItem: (itemId: string) => Promise<{
    kitchenPrintDocuments?: string[];
    orderRemoved?: boolean;
  } | void>;
  selectCurrentOrder: (data: TCanonicalData) => TOrder | undefined;
  addOrderItem: (
    orderId: string,
    menuItem: TMenuItem,
    note: string,
    selectedModifiers?: PosModifierSelection[],
    manualPrice?: number,
  ) => Promise<{ kitchenPrintDocuments?: string[] } | void>;
  addOrderItems?: (
    orderId: string,
    items: Array<{
      menuItem: TMenuItem;
      quantity: number;
      note: string;
      selectedModifiers?: PosModifierSelection[];
      manualPrice?: number;
    }>,
  ) => Promise<{ kitchenPrintDocuments?: string[] } | void>;
  onPrintDocuments?: (documentIds: string[]) => void;
  onOrderRemoved?: (removedOrder: TOrder | undefined) => void;
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
    defaultServiceFeeComponents,
    defaultServiceFeeStartedAt,
    defaultVatEnabled,
    defaultVatPercent,
    removeOrderItem,
    onPrintDocuments,
    onOrderRemoved,
    resetKey,
    selectCurrentOrder,
    addOrderItem,
    addOrderItems,
    syncErrorMessage,
  } = options;
  const [resolvedBaseOrder, setResolvedBaseOrder] = useState<TOrder | undefined>(baseOrder);
  const [serviceFeeNow, setServiceFeeNow] = useState(() => Date.now());
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
    const timer = window.setInterval(() => setServiceFeeNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

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
    resolvedOrderIdRef.current = currentOrder?.id ?? null;
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
          orderId = await createOrder();
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

        const mutationResult = await addOrderItem(
          orderId,
          operationBeforeAdd.menuItem,
          operationBeforeAdd.note,
          operationBeforeAdd.selectedModifiers,
          operationBeforeAdd.manualPrice,
        );
        if (mutationResult?.kitchenPrintDocuments?.length) {
          onPrintDocuments?.(mutationResult.kitchenPrintDocuments);
        }

        const operationAfterAdd = getPendingAddById(opId);

        if (operationAfterAdd?.canceled) {
          const refreshedOrder = await refreshCurrentOrder();
          const createdItem = findLatestOrderItem(refreshedOrder?.items, {
            catalogItemId: operationAfterAdd.menuItem.id,
            note: operationAfterAdd.note,
            modifiers: selectedModifierOptions(
              operationAfterAdd.menuItem.modifierGroups ?? [],
              operationAfterAdd.selectedModifiers ?? [],
            ).map(({ group, option }) => ({
              optionId: option.id,
              groupName: group.name,
              optionName: option.name,
              priceDelta: option.priceDelta,
            })),
          });

          if (createdItem) {
            const removalResult = await removeOrderItem(createdItem.id);
            if (removalResult?.kitchenPrintDocuments?.length) {
              onPrintDocuments?.(removalResult.kitchenPrintDocuments);
            }
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
      onPrintDocuments,
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
        const mutationResult = await removeOrderItem(operation.itemId);
        if (mutationResult?.kitchenPrintDocuments?.length) {
          onPrintDocuments?.(mutationResult.kitchenPrintDocuments);
        }
        if (mutationResult?.orderRemoved) {
          resolvedOrderIdRef.current = null;
          tempOrderIdRef.current = null;
          setResolvedBaseOrder(undefined);
          await queryClient.invalidateQueries({ queryKey: canonicalQueryKey });
          onOrderRemoved?.(resolvedBaseOrder);
        } else {
          await refreshCurrentOrder();
        }
      } catch {
        await refreshCurrentOrder().catch(() => undefined);
        toast.error(syncErrorMessage);
      } finally {
        settleRemoveOperation(operation.opId);
      }
    },
    [
      canonicalQueryKey,
      onOrderRemoved,
      onPrintDocuments,
      refreshCurrentOrder,
      removeOrderItem,
      resolvedBaseOrder,
      settleRemoveOperation,
      syncErrorMessage,
    ],
  );

  const runBatchAddOperation = useCallback(
    async (opIds: string[]) => {
      const queuedOperations = opIds
        .map((opId) => getPendingAddById(opId))
        .filter((operation): operation is PendingAddOperation<TMenuItem> => Boolean(operation && !operation.canceled));
      if (!queuedOperations.length || !addOrderItems) {
        opIds.forEach(settleAddOperation);
        return;
      }

      let createdOrderId: string | null = null;
      try {
        let orderId = resolvedOrderIdRef.current;
        if (!orderId) {
          orderId = await createOrder();
          resolvedOrderIdRef.current = orderId;
          createdOrderId = orderId;
        }

        const operationsBeforeAdd = queuedOperations.filter(
          (operation) => !getPendingAddById(operation.opId)?.canceled,
        );
        if (!operationsBeforeAdd.length) return;
        const mutationResult = await addOrderItems(
          orderId,
          operationsBeforeAdd.map((operation) => ({
            menuItem: operation.menuItem,
            quantity: Math.max(operation.menuItem.saleUnit === 'kg' ? 0.001 : 1, Number(operation.quantity ?? 1)),
            note: operation.note,
            selectedModifiers: operation.selectedModifiers,
            manualPrice: operation.manualPrice,
          })),
        );
        if (mutationResult?.kitchenPrintDocuments?.length) {
          onPrintDocuments?.(mutationResult.kitchenPrintDocuments);
        }

        let refreshedOrder = await refreshCurrentOrder();
        for (const operation of operationsBeforeAdd) {
          if (!getPendingAddById(operation.opId)?.canceled) continue;
          const createdItem = findLatestOrderItem(refreshedOrder?.items, {
            catalogItemId: operation.menuItem.id,
            note: operation.note,
            modifiers: selectedModifierOptions(
              operation.menuItem.modifierGroups ?? [],
              operation.selectedModifiers ?? [],
            ).map(({ group, option }) => ({
              optionId: option.id,
              groupName: group.name,
              optionName: option.name,
              priceDelta: option.priceDelta,
            })),
          });
          if (createdItem) {
            const removalResult = await removeOrderItem(createdItem.id);
            if (removalResult?.kitchenPrintDocuments?.length) {
              onPrintDocuments?.(removalResult.kitchenPrintDocuments);
            }
            refreshedOrder = await refreshCurrentOrder();
          }
        }
      } catch {
        if (!createdOrderId || resolvedBaseOrder) {
          await refreshCurrentOrder().catch(() => undefined);
        }
        toast.error(syncErrorMessage);
      } finally {
        opIds.forEach(settleAddOperation);
      }
    },
    [
      addOrderItems,
      createOrder,
      getPendingAddById,
      onPrintDocuments,
      refreshCurrentOrder,
      removeOrderItem,
      resolvedBaseOrder,
      settleAddOperation,
      syncErrorMessage,
    ],
  );

  const addItem = useCallback(
    (menuItem: TMenuItem, note: string, selectedModifiers: PosModifierSelection[] = [], manualPrice?: number) => {
      const opId = createOperationId();
      const tempItemId = createOperationId();

      setPendingAdds((current) => [
        ...current,
        { opId, tempItemId, menuItem, note, selectedModifiers, manualPrice, canceled: false },
      ]);
      enqueue(() => runAddOperation(opId));
    },
    [enqueue, runAddOperation],
  );

  const addItems = useCallback(
    (
      items: Array<{
        menuItem: TMenuItem;
        quantity: number;
        note: string;
        selectedModifiers?: PosModifierSelection[];
        manualPrice?: number;
      }>,
    ) => {
      if (!addOrderItems) {
        for (const item of items) {
          for (let index = 0; index < item.quantity; index += 1) {
            addItem(item.menuItem, item.note, item.selectedModifiers, item.manualPrice);
          }
        }
        return;
      }

      const operations: PendingAddOperation<TMenuItem>[] = items
        .filter((item) => item.quantity > 0)
        .map((item) => ({
          opId: createOperationId(),
          tempItemId: createOperationId(),
          menuItem: item.menuItem,
          note: item.note,
          quantity: item.quantity,
          selectedModifiers: item.selectedModifiers,
          manualPrice: item.manualPrice,
          canceled: false,
        }));
      if (!operations.length) return;
      pendingAddsRef.current = [...pendingAddsRef.current, ...operations];
      setPendingAdds((current) => [...current, ...operations]);
      enqueue(() => runBatchAddOperation(operations.map((operation) => operation.opId)));
    },
    [addItem, addOrderItems, enqueue, runBatchAddOperation],
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
      defaultServiceFeeComponents,
      defaultServiceFeeStartedAt,
      serviceFeeNow,
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
    defaultServiceFeeComponents,
    defaultServiceFeeStartedAt,
    defaultVatEnabled,
    defaultVatPercent,
    pendingAdds,
    pendingRemoves,
    resolvedBaseOrder,
    serviceFeeNow,
  ]);

  return {
    addItem,
    addItems,
    currentOrder: optimisticOrder,
    hasPendingOperations: pendingAdds.length > 0 || pendingRemoves.length > 0,
    removeItem,
  };
}
