import { useState } from 'react';

import { canAddCashierPaymentOrderItems, canAccessWaiterTables, canRemoveCashierPaymentOrderItems } from 'modules/auth';
import {
  useAddCashierPaymentOrderItemMutation,
  useCashierUpdateOrderDisplayNameMutation,
  useRemoveCashierPaymentOrderItemMutation,
} from 'modules/cashier/application';
import type { PosOrderItemModifier } from 'shared/pos/modifiers';
import { selectionPayloadFromOrderModifiers } from 'shared/pos/modifiers';

import { getMutationErrorPayload } from './payment-error-debug';

type PaymentOrderEditingOptions = {
  displayName?: string | null;
  isBuilderOrder: boolean;
  orderId: string | null;
  renameFailedMessage: string;
  user: Parameters<typeof canAddCashierPaymentOrderItems>[0];
};

export function usePaymentOrderEditing({
  displayName,
  isBuilderOrder,
  orderId,
  renameFailedMessage,
  user,
}: PaymentOrderEditingOptions) {
  const [addingItemId, setAddingItemId] = useState<string | null>(null);
  const [removingItemId, setRemovingItemId] = useState<string | null>(null);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState('');

  const addMutation = useAddCashierPaymentOrderItemMutation({
    orderId,
    onSuccess: () => setAddingItemId(null),
  });
  const removeMutation = useRemoveCashierPaymentOrderItemMutation({
    orderId,
    onSuccess: () => setRemovingItemId(null),
  });
  const renameMutation = useCashierUpdateOrderDisplayNameMutation({
    onSuccess: () => {
      setRenameDialogOpen(false);
      setRenameError('');
    },
  });

  const canAddItems = isBuilderOrder ? canAddCashierPaymentOrderItems(user) : canAccessWaiterTables(user);
  const canRemoveItems = Boolean(isBuilderOrder && canRemoveCashierPaymentOrderItems(user));

  const addItem = async (
    itemId: string,
    catalogItemId: string,
    note?: string | null,
    modifiers?: PosOrderItemModifier[],
  ) => {
    if (!canAddItems || addMutation.isPending) {
      return;
    }

    setAddingItemId(itemId);
    try {
      const selectedModifiers = selectionPayloadFromOrderModifiers(modifiers);
      await addMutation.mutateAsync({
        catalogItemId,
        note: note ?? '',
        ...(selectedModifiers.length ? { selectedModifiers } : {}),
      });
    } catch {
      setAddingItemId(null);
    }
  };

  const removeItem = async (itemId: string) => {
    if (!canRemoveItems || removeMutation.isPending) {
      return;
    }

    setRemovingItemId(itemId);
    try {
      await removeMutation.mutateAsync(itemId);
    } catch {
      setRemovingItemId(null);
    }
  };

  const openRenameDialog = () => {
    setRenameValue(displayName?.trim() ?? '');
    setRenameError('');
    setRenameDialogOpen(true);
  };

  const changeRenameValue = (value: string) => {
    setRenameValue(value);
    if (renameError) {
      setRenameError('');
    }
  };

  const saveRename = async () => {
    if (!orderId) {
      return;
    }

    try {
      await renameMutation.mutateAsync({ orderId, displayName: renameValue.trim() });
    } catch (error) {
      const payload = getMutationErrorPayload(error);
      setRenameError(payload?.displayName?.[0] ?? payload?.detail ?? renameFailedMessage);
    }
  };

  return {
    addItem,
    addingItemId,
    addPending: addMutation.isPending,
    canAddItems,
    canRemoveItems,
    changeRenameValue,
    closeRenameDialog: () => setRenameDialogOpen(false),
    openRenameDialog,
    removeItem,
    removingItemId,
    removePending: removeMutation.isPending,
    renameDialogOpen,
    renameError,
    renamePending: renameMutation.isPending,
    renameValue,
    saveRename,
  };
}
