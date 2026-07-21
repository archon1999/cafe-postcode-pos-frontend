import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';

import { cashierRepository } from 'modules/cashier/data-access';
import {
  isValidDeliveryPhone,
  normalizeDeliveryAddress,
  type CashierBuilderOrderChannel,
  type CashierOrder,
} from 'modules/cashier/domain';
import { getApiErrorMessage } from 'shared/api/errorMessage';
import { isTemporaryBuilderId } from 'shared/pos/optimistic-builder-order';

import type { PendingDeliveryAction } from './CashierDeliveryDetailsDialog';

type Options = {
  builderChannel: CashierBuilderOrderChannel;
  currentOrder?: CashierOrder | null;
  editOrderId: string | null;
  errorFallback: string;
  hasMissingMarkings: boolean;
  hasPendingOperations: boolean;
  missingMarkingMessage: string;
  orderNote: string;
  serverOrder?: CashierOrder | null;
  submitOrder: () => Promise<unknown>;
  submitPending: boolean;
  closeCart: () => void;
  navigateToPayment: (orderId: string) => void;
  refetchEditOrder: () => Promise<unknown>;
  refetchOrders: () => Promise<unknown>;
  reportMessage: (message: string) => void;
  setBuilderChannel: Dispatch<SetStateAction<CashierBuilderOrderChannel>>;
  clearSelectedCartItem: () => void;
};

export function useCashierBuilderActions({
  builderChannel,
  currentOrder,
  editOrderId,
  errorFallback,
  hasMissingMarkings,
  hasPendingOperations,
  missingMarkingMessage,
  orderNote,
  serverOrder,
  submitOrder,
  submitPending,
  closeCart,
  navigateToPayment,
  refetchEditOrder,
  refetchOrders,
  reportMessage,
  setBuilderChannel,
  clearSelectedCartItem,
}: Options) {
  const [deliveryDialogOpen, setDeliveryDialogOpen] = useState(false);
  const [pendingDeliveryAction, setPendingDeliveryAction] = useState<PendingDeliveryAction | null>(null);
  const [deliveryPhone, setDeliveryPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryDetailsAttempted, setDeliveryDetailsAttempted] = useState(false);
  const [deliveryDetailsSaving, setDeliveryDetailsSaving] = useState(false);
  const [channelSwitchSaving, setChannelSwitchSaving] = useState(false);

  const normalizedDeliveryAddress = normalizeDeliveryAddress(deliveryAddress);
  const isDeliveryPhoneValid = isValidDeliveryPhone(deliveryPhone);
  const isDeliveryAddressValid = normalizedDeliveryAddress.length > 0;
  const busy = submitPending || hasPendingOperations;

  const runDeliveryAction = async (action: PendingDeliveryAction) => {
    if (!currentOrder) return;
    if ((currentOrder.note ?? '') !== orderNote) {
      await cashierRepository.updateOrderNote(currentOrder.id, orderNote);
    }
    await submitOrder();
    if (action === 'checkout') {
      closeCart();
      navigateToPayment(currentOrder.id);
    }
  };

  const openDeliveryDetailsDialog = (action: PendingDeliveryAction) => {
    setPendingDeliveryAction(action);
    setDeliveryPhone(currentOrder?.deliveryPhone ?? deliveryPhone);
    setDeliveryAddress(currentOrder?.deliveryAddress ?? deliveryAddress);
    setDeliveryDetailsAttempted(false);
    setDeliveryDialogOpen(true);
  };

  const runOrderAction = async (action: PendingDeliveryAction) => {
    if (!currentOrder || busy) return;
    if (hasMissingMarkings) {
      reportMessage(missingMarkingMessage);
      return;
    }
    if (builderChannel === 'delivery') {
      openDeliveryDetailsDialog(action);
      return;
    }
    if ((currentOrder.note ?? '') !== orderNote) {
      await cashierRepository.updateOrderNote(currentOrder.id, orderNote);
    }
    if (action === 'submit') {
      await submitOrder();
    } else {
      closeCart();
      navigateToPayment(currentOrder.id);
    }
  };

  const confirmDeliveryDetails = async () => {
    if (!currentOrder || !pendingDeliveryAction) return;
    if (!isDeliveryPhoneValid || !isDeliveryAddressValid) {
      setDeliveryDetailsAttempted(true);
      return;
    }
    setDeliveryDetailsSaving(true);
    try {
      await cashierRepository.updateOrderDeliveryDetails(currentOrder.id, {
        deliveryPhone,
        deliveryAddress: normalizedDeliveryAddress,
      });
      const action = pendingDeliveryAction;
      setDeliveryDialogOpen(false);
      setPendingDeliveryAction(null);
      await runDeliveryAction(action);
    } catch (error) {
      reportMessage(getApiErrorMessage(error, errorFallback));
    } finally {
      setDeliveryDetailsSaving(false);
    }
  };

  const closeDeliveryDialog = () => {
    setDeliveryDialogOpen(false);
    setPendingDeliveryAction(null);
  };

  const changeChannel = async (channel: CashierBuilderOrderChannel) => {
    if (channel === builderChannel || channelSwitchSaving) return;
    if (!currentOrder || isTemporaryBuilderId(currentOrder.id)) {
      setBuilderChannel(channel);
      clearSelectedCartItem();
      return;
    }
    setChannelSwitchSaving(true);
    try {
      await cashierRepository.updateOrderChannel(currentOrder.id, channel);
      setBuilderChannel(channel);
      clearSelectedCartItem();
      void Promise.allSettled([refetchOrders(), ...(editOrderId ? [refetchEditOrder()] : [])]);
    } catch (error) {
      reportMessage(getApiErrorMessage(error, errorFallback));
    } finally {
      setChannelSwitchSaving(false);
    }
  };

  useEffect(() => {
    const serverChannel = serverOrder?.channel;
    if (
      channelSwitchSaving ||
      (serverChannel !== 'hall' && serverChannel !== 'takeaway' && serverChannel !== 'delivery')
    ) {
      return;
    }
    setBuilderChannel((current) => (current === serverChannel ? current : serverChannel));
  }, [channelSwitchSaving, serverOrder?.channel, setBuilderChannel]);

  useEffect(() => {
    if (!currentOrder?.id || currentOrder.channel !== 'delivery') return;
    setDeliveryPhone(currentOrder.deliveryPhone ?? '');
    setDeliveryAddress(currentOrder.deliveryAddress ?? '');
  }, [currentOrder?.id, currentOrder?.channel, currentOrder?.deliveryPhone, currentOrder?.deliveryAddress]);

  return {
    changeChannel,
    channelSwitchSaving,
    closeDeliveryDialog,
    confirmDeliveryDetails,
    deliveryAddress,
    deliveryDetailsAttempted,
    deliveryDetailsSaving,
    deliveryDialogOpen,
    deliveryPhone,
    isDeliveryAddressValid,
    isDeliveryPhoneValid,
    pendingDeliveryAction,
    runOrderAction,
    setDeliveryAddress,
    setDeliveryPhone,
  };
}
