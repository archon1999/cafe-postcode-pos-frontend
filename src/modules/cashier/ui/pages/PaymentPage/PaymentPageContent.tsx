import { Icon } from '@iconify/react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Snackbar,
  Stack,
  TextField,
  Typography,
  alpha,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';

import {
  canAddCashierPaymentOrderItems,
  canAccessTakeawayBuilder,
  canAccessWaiterTables,
  canManageCashierPayments,
  canRemoveCashierPaymentOrderItems,
  canSkipFiscalReceipts,
  usePosSession,
} from 'modules/auth';
import {
  useAddCashierPaymentOrderItemMutation,
  useCashierContextQuery,
  useCashierOrderScanMutation,
  useCashierPaymentMutation,
  useCashierPaymentOrderQuery,
  useCashierUpdateOrderDisplayNameMutation,
  useRemoveCashierPaymentOrderItemMutation,
} from 'modules/cashier/application';
import {
  aggregateCashierOrderItems,
  getCashierOrderDisplayName,
  getCashierOrderNumberLabel,
  type CashierPaymentResponse,
  type PaymentMethod,
} from 'modules/cashier/domain';
import { getApiErrorMessage } from 'shared/api/errorMessage';
import { PosPageFrame } from 'shared/layout/PosPageFrame';
import { formatPosCopy, getPosCopy } from 'shared/locale/copy';
import { useScannerInput } from 'shared/pos/useScannerInput';
import { formatCompactMoney, formatTime } from 'shared/pos/utils';
import { printReceiptWithFallback } from 'shared/printing/browserReceipt';
import { PosIconAction, PosSettingsMenu } from 'shared/ui/pos-primitives';

export type PaymentPageContentProps = {
  orderId?: string | null;
};

type MutationErrorPayload = {
  displayName?: string[];
  detail?: string;
  payment?: {
    providerPayload?: Record<string, unknown> | null;
    provider_payload?: Record<string, unknown> | null;
  };
};

function getMutationErrorDetail(error: unknown) {
  const errorResponse = (error as { response?: { data?: MutationErrorPayload } })?.response?.data;
  return errorResponse?.detail ?? '';
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function responseHttpStatus(exchange: unknown) {
  const exchangeRecord = asRecord(exchange);
  const response = asRecord(exchangeRecord?.response);
  const status = response?.httpStatus ?? response?.http_status;
  return typeof status === 'number' ? status : Number(status || 0);
}

function getMartaNon2xxDebugJson(error: unknown) {
  const errorResponse = (error as { response?: { data?: MutationErrorPayload } })?.response?.data;
  const payment = errorResponse?.payment;
  const providerPayload = asRecord(payment?.providerPayload ?? payment?.provider_payload);
  if (!providerPayload || providerPayload.provider !== 'marta-softpos') {
    return '';
  }

  const debug = asRecord(providerPayload.debug);
  if (!debug) {
    return '';
  }

  const hasNon2xxResponse = Object.values(debug).some((exchange) => {
    const status = responseHttpStatus(exchange);
    return status >= 300;
  });
  if (!hasNon2xxResponse) {
    return '';
  }

  return JSON.stringify(
    {
      detail: errorResponse?.detail ?? providerPayload.detail ?? providerPayload.message ?? '',
      provider: providerPayload.provider,
      status: providerPayload.status,
      requestId: providerPayload.requestId ?? providerPayload.request_id,
      debug,
    },
    null,
    2,
  );
}

function formatPercent(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');
}

export function PaymentPageContent({ orderId }: PaymentPageContentProps) {
  const navigate = useNavigate();
  const { session, locale, setLocale, setSession, themeMode, setThemeMode } = usePosSession();
  const copy = getPosCopy(locale);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [settingsAnchor, setSettingsAnchor] = useState<HTMLElement | null>(null);
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [amount, setAmount] = useState('0');
  const [pendingRegisterFiscal, setPendingRegisterFiscal] = useState(true);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [qrCountdown, setQrCountdown] = useState(5);
  const [receiptData, setReceiptData] = useState<CashierPaymentResponse | null>(null);
  const [paymentErrorToastOpen, setPaymentErrorToastOpen] = useState(false);
  const [paymentErrorMessage, setPaymentErrorMessage] = useState('');
  const [cardFailureDialogOpen, setCardFailureDialogOpen] = useState(false);
  const [lastCardFailureMessage, setLastCardFailureMessage] = useState('');
  const [lastCardFailureDebugJson, setLastCardFailureDebugJson] = useState('');
  const [printToastOpen, setPrintToastOpen] = useState(false);
  const [receiptPrintPromptOpen, setReceiptPrintPromptOpen] = useState(false);
  const [isReceiptPrintConfirming, setIsReceiptPrintConfirming] = useState(false);
  const [addingItemId, setAddingItemId] = useState<string | null>(null);
  const [removingItemId, setRemovingItemId] = useState<string | null>(null);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState('');
  const canProcessPayments = canManageCashierPayments(session?.user);
  const canDisableFiscalRegistration = canSkipFiscalReceipts(session?.user);
  const normalizedOrderId = orderId ?? null;

  const cashierContextQuery = useCashierContextQuery({
    enabled: Boolean(session?.token) && canProcessPayments,
    refetchInterval: canProcessPayments ? 15000 : false,
  });
  const orderQuery = useCashierPaymentOrderQuery(normalizedOrderId);
  const paymentMutation = useCashierPaymentMutation({
    orderId: normalizedOrderId,
    onSuccess: () => setQrDialogOpen(false),
  });
  const addPaymentOrderItemMutation = useAddCashierPaymentOrderItemMutation({
    orderId: normalizedOrderId,
    onSuccess: () => setAddingItemId(null),
  });
  const removePaymentOrderItemMutation = useRemoveCashierPaymentOrderItemMutation({
    orderId: normalizedOrderId,
    onSuccess: () => setRemovingItemId(null),
  });
  const updateOrderDisplayNameMutation = useCashierUpdateOrderDisplayNameMutation({
    onSuccess: () => {
      setRenameDialogOpen(false);
      setRenameError('');
    },
  });
  const scanMarkingMutation = useCashierOrderScanMutation({
    orderId: normalizedOrderId,
    mode: 'remove',
  });
  const selectedCashDesk = useMemo(() => {
    const cashDesks = cashierContextQuery.data?.availableCashDesks ?? [];
    const activeCashDeskId = cashierContextQuery.data?.currentShift?.cashDesk;
    return cashDesks.find((cashDesk) => cashDesk.id === activeCashDeskId) ?? cashDesks[0] ?? null;
  }, [cashierContextQuery.data?.availableCashDesks, cashierContextQuery.data?.currentShift?.cashDesk]);

  const remainingTotal = useMemo(() => {
    const total = Number(orderQuery.data?.total ?? 0);
    const paidTotal = (orderQuery.data?.payments ?? [])
      .filter((payment) => payment.status === 'succeeded')
      .reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);

    return Math.max(total - paidTotal, 0);
  }, [orderQuery.data?.payments, orderQuery.data?.total]);
  const aggregatedOrderItems = useMemo(
    () => aggregateCashierOrderItems(orderQuery.data?.items),
    [orderQuery.data?.items],
  );
  const orderNumberLabel = useMemo(
    () => getCashierOrderNumberLabel({ orderNumber: orderQuery.data?.orderNumber ?? 0 }),
    [orderQuery.data?.orderNumber],
  );
  const orderDisplayName = useMemo(
    () =>
      getCashierOrderDisplayName({
        orderNumber: orderQuery.data?.orderNumber ?? 0,
        displayName: orderQuery.data?.displayName,
      }),
    [orderQuery.data?.displayName, orderQuery.data?.orderNumber],
  );
  const hasCustomOrderName = Boolean(orderQuery.data?.displayName?.trim());
  const isBuilderOrder = orderQuery.data?.channel === 'takeaway' || orderQuery.data?.channel === 'delivery';
  const canAddPaymentItems = isBuilderOrder
    ? canAddCashierPaymentOrderItems(session?.user)
    : canAccessWaiterTables(session?.user);
  const canRemovePaymentItems = Boolean(isBuilderOrder && canRemoveCashierPaymentOrderItems(session?.user));
  const markingMissingCount = useMemo(
    () =>
      (orderQuery.data?.items ?? []).reduce((sum, item) => {
        const required = Number(item.markingRequiredCount ?? item.marking_required_count ?? 0);
        const scanned = Number(item.markingScannedCount ?? item.marking_scanned_count ?? item.markings?.length ?? 0);
        return sum + Math.max(required - scanned, 0);
      }, 0),
    [orderQuery.data?.items],
  );

  useEffect(() => {
    if (remainingTotal > 0) {
      setAmount(String(remainingTotal));
    }
  }, [remainingTotal]);

  useEffect(() => {
    if (paymentMutation.isError) {
      const detail = getMutationErrorDetail(paymentMutation.error) || copy.paymentFailed;
      setPaymentErrorMessage(detail);
      setPaymentErrorToastOpen(true);
      if (method === 'card') {
        setLastCardFailureMessage(detail);
        setLastCardFailureDebugJson(getMartaNon2xxDebugJson(paymentMutation.error));
        setCardFailureDialogOpen(true);
      }
    }
  }, [copy.paymentFailed, paymentMutation.error, paymentMutation.isError]);

  useEffect(() => {
    if (!qrDialogOpen || method !== 'qr' || paymentMutation.isPending || paymentMutation.isSuccess) {
      return;
    }

    setQrCountdown(5);
    const intervalId = window.setInterval(() => {
      setQrCountdown((currentValue) => (currentValue > 0 ? currentValue - 1 : 0));
    }, 1000);
    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await paymentMutation.mutateAsync({
          method: 'qr',
          amount: Number(amount || 0),
          registerFiscal: pendingRegisterFiscal,
        });
        setReceiptData(response);
      } catch (error) {
        setPaymentErrorMessage(getMutationErrorDetail(error) || copy.paymentFailed);
        setPaymentErrorToastOpen(true);
      }
    }, 5000);

    return () => {
      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
    };
  }, [amount, method, paymentMutation, pendingRegisterFiscal, qrDialogOpen]);

  const paymentOptions = useMemo(
    () =>
      (selectedCashDesk?.enabledPaymentMethods ?? ['cash', 'card', 'qr']).map((value) => ({
        value,
        label: value === 'cash' ? copy.cash : value === 'card' ? copy.card : copy.qr,
      })),
    [copy.card, copy.cash, copy.qr, selectedCashDesk?.enabledPaymentMethods],
  );

  const afterPaymentPath =
    isBuilderOrder && canAccessTakeawayBuilder(session?.user) ? '/cashier/builder' : '/cashier/open-checks';
  const canSubmitPayment = Boolean(
    normalizedOrderId &&
      canProcessPayments &&
      cashierContextQuery.data?.currentShift &&
      markingMissingCount === 0 &&
      Number(amount || 0) > 0 &&
      !paymentMutation.isPending,
  );
  const serviceFeePercent = Number(orderQuery.data?.serviceFeePercent ?? 0);
  const serviceFeeAmount = Number(orderQuery.data?.serviceFee ?? 0);
  const serviceFeeEnabled = Boolean(orderQuery.data?.serviceFeeEnabled ?? serviceFeePercent > 0);
  const shouldShowServiceFee = serviceFeeEnabled && (serviceFeePercent > 0 || serviceFeeAmount > 0);
  const serviceFeeLabel = `${copy.serviceFee} (${serviceFeePercent}%)`;
  const vatEnabled = Boolean(orderQuery.data?.vatEnabled);
  const vatPercent = Number(orderQuery.data?.vatPercent ?? 0);
  const vatAmount = Number(orderQuery.data?.vatAmount ?? 0);
  const shouldShowVat = vatEnabled && vatPercent > 0;
  const vatLabel = `${copy.vat} (${formatPercent(vatPercent)}%)`;
  const receiptDialogReceipts = useMemo(
    () => receiptData?.receipts?.filter(Boolean) ?? (receiptData?.receipt ? [receiptData.receipt] : []),
    [receiptData?.receipt, receiptData?.receipts],
  );
  const primaryReceipt = receiptDialogReceipts[0] ?? receiptData?.receipt ?? null;
  const isPaymentProcessing = paymentMutation.isPending;
  const fallbackReceiptPayload = useMemo(() => {
    if (!receiptData) {
      return null;
    }
    const order = receiptData.order;
    const payment = receiptData.payment;
    const receiptNumber = payment.externalRef || getCashierOrderNumberLabel({ orderNumber: order.orderNumber });
    const activeItems = aggregateCashierOrderItems(order.items?.filter((item) => item.status !== 'cancelled'));
    const paymentAmount = Number(payment.amount ?? 0);
    const isCash = payment.method === 'cash';

    return {
      snapshot: {
        restaurant_name: session?.restaurantContext?.restaurantName ?? 'Chek',
        restaurant_legal_name: session?.restaurantContext?.restaurantName ?? 'Chek',
        order_number: getCashierOrderNumberLabel({ orderNumber: order.orderNumber }),
        receipt_number: receiptNumber,
        channel_label: 'sotuv',
        table_label:
          order.tableName || order.hallName ? [order.hallName, order.tableName].filter(Boolean).join(' / ') : '',
        delivery_phone: order.deliveryPhone ?? '',
        delivery_address: order.deliveryAddress ?? '',
        cashier_name: session?.user.fullName || session?.user.username || '',
        cashier_id: session?.user.id || '',
        printed_at_label: payment.paidAt || new Date().toISOString(),
        items: activeItems.map((item) => ({
          name: item.catalogItemName,
          quantity: item.quantity,
          line_total: item.lineTotal,
          note: item.note,
        })),
        subtotal: order.subtotal,
        service_fee: order.serviceFee,
        vat_enabled: order.vatEnabled,
        vat_percent: order.vatPercent,
        vat_amount: order.vatAmount,
        total: paymentAmount,
        received_cash: isCash ? paymentAmount : 0,
        received_card: isCash ? 0 : paymentAmount,
        order_note: order.note,
      },
    };
  }, [
    receiptData,
    session?.restaurantContext?.restaurantName,
    session?.user.fullName,
    session?.user.id,
    session?.user.username,
  ]);

  const finishReceiptFlow = () => {
    setReceiptPrintPromptOpen(false);
    setReceiptData(null);
    void navigate(afterPaymentPath, { replace: true });
  };

  const handleReceiptPromptPrint = async () => {
    if (isReceiptPrintConfirming) {
      return;
    }

    setIsReceiptPrintConfirming(true);
    try {
      const receiptsToPrint = receiptDialogReceipts.length > 0 ? receiptDialogReceipts : [null];
      await Promise.all(
        receiptsToPrint.map((receipt) => printReceiptWithFallback(receipt?.payload ?? fallbackReceiptPayload)),
      );
      setPrintToastOpen(true);
    } catch {
      // Keep the cashier flow moving even if the browser blocks a print window.
    } finally {
      setIsReceiptPrintConfirming(false);
      finishReceiptFlow();
    }
  };

  useScannerInput({
    enabled: Boolean(normalizedOrderId && canProcessPayments && !receiptData),
    onScan: async (rawCode) => {
      try {
        await scanMarkingMutation.mutateAsync(rawCode);
      } catch (error) {
        setPaymentErrorMessage(
          getApiErrorMessage(error, 'Bunaqa mahsulot orderda yo‘q yoki markirovka kodi yaroqsiz.'),
        );
        setPaymentErrorToastOpen(true);
      }
    },
  });

  const handlePayment = async (registerFiscal: boolean) => {
    setPendingRegisterFiscal(registerFiscal);
    if (method === 'qr') {
      setQrDialogOpen(true);
      return;
    }

    try {
      const response = await paymentMutation.mutateAsync({ method, amount: Number(amount || 0), registerFiscal });
      setReceiptData(response);
    } catch (error) {
      const detail = getMutationErrorDetail(error) || copy.paymentFailed;
      setPaymentErrorMessage(detail);
      setPaymentErrorToastOpen(true);
      if (method === 'card') {
        setLastCardFailureMessage(detail);
        setLastCardFailureDebugJson(getMartaNon2xxDebugJson(error));
        setCardFailureDialogOpen(true);
      }
    }
  };

  const handleManualCardComplete = async () => {
    try {
      const response = await paymentMutation.mutateAsync({
        method: 'card',
        amount: Number(amount || 0),
        registerFiscal: pendingRegisterFiscal,
        manualCardOverride: true,
        manualCardReason: lastCardFailureMessage,
      });
      setCardFailureDialogOpen(false);
      setReceiptData(response);
    } catch (error) {
      setPaymentErrorMessage(getMutationErrorDetail(error) || copy.paymentFailed);
      setPaymentErrorToastOpen(true);
    }
  };

  const handleCopyCardFailureDebug = async () => {
    if (!lastCardFailureDebugJson) {
      return;
    }

    await navigator.clipboard?.writeText(lastCardFailureDebugJson);
  };

  const handleAddOrderItem = async (itemId: string, catalogItemId: string, note?: string | null) => {
    if (!canAddPaymentItems || addPaymentOrderItemMutation.isPending) {
      return;
    }

    setAddingItemId(itemId);

    try {
      await addPaymentOrderItemMutation.mutateAsync({
        catalogItemId,
        note: note ?? '',
      });
    } catch {
      setAddingItemId(null);
    }
  };

  const handleRemoveOrderItem = async (itemId: string) => {
    if (!canRemovePaymentItems || removePaymentOrderItemMutation.isPending) {
      return;
    }

    setRemovingItemId(itemId);

    try {
      await removePaymentOrderItemMutation.mutateAsync(itemId);
    } catch {
      setRemovingItemId(null);
    }
  };

  const handleOpenRenameDialog = () => {
    setRenameValue(orderQuery.data?.displayName?.trim() ?? '');
    setRenameError('');
    setRenameDialogOpen(true);
  };

  const handleRenameOrder = async () => {
    if (!normalizedOrderId) {
      return;
    }

    try {
      await updateOrderDisplayNameMutation.mutateAsync({
        orderId: normalizedOrderId,
        displayName: renameValue.trim(),
      });
    } catch (error) {
      const errorResponse = (error as { response?: { data?: MutationErrorPayload } })?.response?.data;
      setRenameError(errorResponse?.displayName?.[0] ?? errorResponse?.detail ?? copy.renameOrderFailed);
    }
  };

  return (
    <PosPageFrame
      header={
        <Stack
          direction="row"
          spacing={{ xs: 1, md: 1.5 }}
          justifyContent="space-between"
          alignItems={{ xs: 'stretch', md: 'center' }}>
          <Stack direction="row" spacing={{ xs: 1, md: 1.5 }}>
            <PosIconAction icon="solar:alt-arrow-left-bold" onClick={() => navigate(afterPaymentPath)} />
            <Typography variant="h4" sx={{ alignSelf: 'center' }}>
              {copy.pay}
            </Typography>
          </Stack>

          <Stack
            direction="row"
            spacing={{ xs: 1, md: 1.5 }}
            sx={{ justifyContent: { xs: 'flex-end', md: 'flex-start' } }}>
            {!isMobile ? (
              <PosIconAction icon="solar:refresh-bold-duotone" onClick={() => window.location.reload()} />
            ) : null}
            <PosIconAction
              icon="solar:settings-bold-duotone"
              onClick={(event) => setSettingsAnchor(event.currentTarget)}
            />
            {!isMobile ? (
              <PosIconAction icon="solar:lock-password-bold-duotone" onClick={() => navigate('/lock-screen')} />
            ) : null}
          </Stack>
        </Stack>
      }>
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 360px' },
          gap: { xs: 2, md: 2.5 },
          alignContent: 'start',
          pb: 0.4,
        }}>
        <Box
          sx={(muiTheme) => ({
            borderRadius: '14px',
            backgroundColor: muiTheme.palette.mode === 'dark' ? '#1f2125' : '#f8f1e8',
            p: { xs: 1.8, md: 2.4 },
            border: `1px solid ${alpha('#ffffff', muiTheme.palette.mode === 'dark' ? 0.04 : 0.28)}`,
          })}>
          <Stack spacing={2}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box
                sx={(muiTheme) => ({
                  minWidth: { xs: 56, md: 62 },
                  height: { xs: 56, md: 62 },
                  borderRadius: '10px',
                  backgroundColor: muiTheme.palette.mode === 'dark' ? '#474c54' : '#dad2c4',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 28,
                  fontWeight: 700,
                })}>
                {orderQuery.data?.channel === 'delivery'
                  ? 'YD'
                  : orderQuery.data?.channel === 'takeaway'
                    ? 'TG'
                    : (orderQuery.data?.tableName?.match(/\d+/)?.[0] ?? '0')}
              </Box>
              <Stack spacing={0.25}>
                <Stack direction="row" spacing={0.75} alignItems="center">
                  <Typography variant="h5">{orderDisplayName}</Typography>
                  <IconButton aria-label={copy.renameOrder} onClick={handleOpenRenameDialog} sx={{ p: 0.4 }}>
                    <Icon icon="solar:pen-2-bold-duotone" width={18} />
                  </IconButton>
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  {hasCustomOrderName ? `${copy.orders}: ${orderNumberLabel}` : copy.orders}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {orderQuery.data?.channel === 'delivery'
                    ? copy.deliveryLabel
                    : orderQuery.data?.channel === 'takeaway'
                      ? copy.takeawayLabel
                      : (orderQuery.data?.hallName ?? copy.hallLabel)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {orderQuery.data?.openedByName}
                </Typography>
              </Stack>
            </Stack>

            <Stack spacing={1.15}>
              {aggregatedOrderItems.map((item) => (
                <Box
                  key={item.key}
                  sx={(muiTheme) => ({
                    borderRadius: '10px',
                    overflow: 'hidden',
                    backgroundColor: muiTheme.palette.mode === 'dark' ? '#2c2f34' : '#ede4d7',
                  })}>
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    spacing={1.2}
                    sx={{ p: 1.65 }}>
                    <Stack spacing={0.35} sx={{ minWidth: 0, flex: 1 }}>
                      <Typography
                        variant="subtitle1"
                        sx={{
                          textDecoration: item.status === 'cancelled' ? 'line-through' : 'none',
                          opacity: item.status === 'cancelled' ? 0.72 : 1,
                        }}>
                        {formatPosCopy(copy.itemQuantityLabel, { name: item.catalogItemName, quantity: item.quantity })}
                      </Typography>
                      {item.note ? (
                        <Typography variant="body2" color="text.secondary">
                          {item.note}
                        </Typography>
                      ) : null}
                      {item.status === 'cancelled' ? (
                        <Typography variant="caption" sx={{ color: 'error.main', fontWeight: 700 }}>
                          {copy.cancelled}
                        </Typography>
                      ) : null}
                    </Stack>
                    <Stack spacing={0.9} alignItems="flex-end">
                      <Typography
                        variant="subtitle1"
                        sx={{
                          whiteSpace: 'nowrap',
                          textDecoration: item.status === 'cancelled' ? 'line-through' : 'none',
                          opacity: item.status === 'cancelled' ? 0.72 : 1,
                        }}>
                        {formatCompactMoney(item.lineTotal, locale)}
                      </Typography>
                      {item.status !== 'cancelled' && (canAddPaymentItems || canRemovePaymentItems) ? (
                        <Stack direction="row" spacing={0.4}>
                          {canRemovePaymentItems ? (
                            <IconButton
                              aria-label={copy.removeOne}
                              disabled={removePaymentOrderItemMutation.isPending}
                              onClick={() => void handleRemoveOrderItem(item.id)}>
                              <Icon
                                icon={
                                  removePaymentOrderItemMutation.isPending && removingItemId === item.id
                                    ? 'solar:refresh-bold'
                                    : 'solar:minus-circle-bold'
                                }
                                width={20}
                              />
                            </IconButton>
                          ) : null}
                          {canAddPaymentItems ? (
                            <IconButton
                              aria-label={copy.addOneMore}
                              disabled={addPaymentOrderItemMutation.isPending}
                              onClick={() => void handleAddOrderItem(item.id, item.catalogItem, item.note)}>
                              <Icon
                                icon={
                                  addPaymentOrderItemMutation.isPending && addingItemId === item.id
                                    ? 'solar:refresh-bold'
                                    : 'solar:add-circle-bold'
                                }
                                width={20}
                              />
                            </IconButton>
                          ) : null}
                        </Stack>
                      ) : null}
                    </Stack>
                  </Stack>
                </Box>
              ))}
            </Stack>
          </Stack>
        </Box>

        <Box
          sx={(muiTheme) => ({
            borderRadius: '14px',
            backgroundColor: muiTheme.palette.mode === 'dark' ? '#1f2125' : '#f8f1e8',
            p: { xs: 1.8, md: 2.4 },
            border: `1px solid ${alpha('#ffffff', muiTheme.palette.mode === 'dark' ? 0.04 : 0.28)}`,
          })}>
          <Stack spacing={2.2}>
            <Typography variant="h5">{copy.paymentMethod}</Typography>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} useFlexGap flexWrap="wrap">
              {paymentOptions.map((option) => (
                <Button
                  key={option.value}
                  variant="contained"
                  onClick={() => setMethod(option.value)}
                  sx={(muiTheme) => ({
                    flex: 1,
                    minWidth: { xs: '100%', sm: 120 },
                    backgroundImage: 'none',
                    backgroundColor:
                      method === option.value
                        ? muiTheme.palette.primary.main
                        : muiTheme.palette.mode === 'dark'
                          ? '#2c2f34'
                          : '#ece4d7',
                    color: method === option.value ? '#ffffff' : 'text.primary',
                  })}>
                  {option.label}
                </Button>
              ))}
            </Stack>

            <TextField label={copy.total} value={amount} onChange={(event) => setAmount(event.target.value)} />

            <Stack spacing={1}>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body1" color="text.secondary">
                  {copy.subtotal}:
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  {formatCompactMoney(orderQuery.data?.subtotal, locale)}
                </Typography>
              </Stack>
              {shouldShowServiceFee ? (
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body1" color="text.secondary">
                    {serviceFeeLabel}:
                  </Typography>
                  <Typography variant="body1" color="text.secondary">
                    {formatCompactMoney(orderQuery.data?.serviceFee, locale)}
                  </Typography>
                </Stack>
              ) : null}
              {shouldShowVat ? (
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body1" color="text.secondary">
                    {vatLabel}:
                  </Typography>
                  <Typography variant="body1" color="text.secondary">
                    {formatCompactMoney(vatAmount, locale)}
                  </Typography>
                </Stack>
              ) : null}
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="h5">{copy.grandTotal}:</Typography>
                <Typography variant="h4">{formatCompactMoney(orderQuery.data?.total, locale)}</Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body1" color="text.secondary">
                  {copy.pay}:
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  {formatCompactMoney(remainingTotal, locale)}
                </Typography>
              </Stack>
              {selectedCashDesk ? (
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body1" color="text.secondary">
                    {copy.cashDesk}:
                  </Typography>
                  <Typography variant="body1" color="text.secondary">
                    {selectedCashDesk.name}
                  </Typography>
                </Stack>
              ) : null}
            </Stack>

            {markingMissingCount > 0 ? (
              <Typography variant="body2" color="warning.main">
                {formatPosCopy(copy.markingMissing, { count: markingMissingCount })}
              </Typography>
            ) : null}

            {!cashierContextQuery.data?.currentShift ? (
              <Typography variant="body2" color="error">
                {copy.openShiftBeforePayment}
              </Typography>
            ) : null}

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <Button
                variant="outlined"
                size="large"
                fullWidth
                disabled={!canSubmitPayment || !canDisableFiscalRegistration}
                onClick={() => void handlePayment(false)}>
                {isPaymentProcessing ? copy.processing : copy.plainPayment}
              </Button>
              <Button
                variant="contained"
                size="large"
                fullWidth
                disabled={!canSubmitPayment}
                onClick={() => void handlePayment(true)}>
                {isPaymentProcessing ? copy.processing : copy.fiscalPayment}
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Box>

      <Dialog open={qrDialogOpen} onClose={() => setQrDialogOpen(false)} maxWidth="xs" fullWidth fullScreen={isMobile}>
        <DialogTitle>{copy.qrTitle}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.2} sx={{ pt: 1 }}>
            <Typography variant="body1" color="text.secondary">
              {copy.qrSubtitle}
            </Typography>

            <Box
              sx={(muiTheme) => ({
                width: 220,
                height: 220,
                mx: 'auto',
                borderRadius: '18px',
                backgroundColor: muiTheme.palette.mode === 'dark' ? '#0f1012' : '#ffffff',
                border: `10px solid ${muiTheme.palette.mode === 'dark' ? '#f6f8fb' : '#111216'}`,
                backgroundImage:
                  'linear-gradient(90deg, rgba(0,0,0,0.92) 12%, transparent 12%, transparent 20%, rgba(0,0,0,0.92) 20%, rgba(0,0,0,0.92) 32%, transparent 32%, transparent 40%, rgba(0,0,0,0.92) 40%, rgba(0,0,0,0.92) 48%, transparent 48%, transparent 56%, rgba(0,0,0,0.92) 56%, rgba(0,0,0,0.92) 68%, transparent 68%, transparent 76%, rgba(0,0,0,0.92) 76%), linear-gradient(rgba(0,0,0,0.92) 12%, transparent 12%, transparent 20%, rgba(0,0,0,0.92) 20%, rgba(0,0,0,0.92) 32%, transparent 32%, transparent 40%, rgba(0,0,0,0.92) 40%, rgba(0,0,0,0.92) 48%, transparent 48%, transparent 56%, rgba(0,0,0,0.92) 56%, rgba(0,0,0,0.92) 68%, transparent 68%, transparent 76%, rgba(0,0,0,0.92) 76%)',
                backgroundSize: '40px 40px',
                position: 'relative',
                overflow: 'hidden',
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  insetInline: 14,
                  top: `${((5 - qrCountdown) / 5) * 180}px`,
                  height: 6,
                  borderRadius: 999,
                  backgroundColor: '#24c5bf',
                  boxShadow: '0 0 18px rgba(36, 197, 191, 0.8)',
                },
              })}
            />

            <Box
              sx={(muiTheme) => ({
                height: 8,
                borderRadius: 999,
                backgroundColor: muiTheme.palette.mode === 'dark' ? '#2a2d31' : '#e4daca',
                overflow: 'hidden',
              })}>
              <Box
                sx={(muiTheme) => ({
                  width: `${((5 - qrCountdown) / 5) * 100}%`,
                  height: '100%',
                  backgroundColor: muiTheme.palette.primary.main,
                })}
              />
            </Box>

            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="body2" color="text.secondary">
                {copy.qrCountdown}
              </Typography>
              <Typography variant="h6">{formatPosCopy(copy.secondsShort, { count: qrCountdown })}</Typography>
            </Stack>

            <Button
              variant="contained"
              onClick={() => setQrDialogOpen(false)}
              sx={(muiTheme) => ({
                backgroundImage: 'none',
                backgroundColor: muiTheme.palette.mode === 'dark' ? '#4d535a' : '#d8cfbf',
                color: muiTheme.palette.mode === 'dark' ? '#f5f5f5' : muiTheme.palette.text.primary,
              })}>
              {copy.cancelQr}
            </Button>
          </Stack>
        </DialogContent>
      </Dialog>

      <Dialog
        open={cardFailureDialogOpen}
        onClose={() => setCardFailureDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        fullScreen={isMobile}>
        <DialogTitle>{copy.cardPaymentFailedTitle}</DialogTitle>
        <DialogContent>
          <Stack spacing={1.4} sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {lastCardFailureMessage || copy.paymentFailed}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {
                copy.cardPaymentFailedDescription
              }
            </Typography>
            {lastCardFailureDebugJson ? (
              <Stack spacing={1}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                  <Typography variant="subtitle2">{copy.martaDebugTitle}</Typography>
                  <Button size="small" variant="contained" onClick={() => void handleCopyCardFailureDebug()}>
                    {copy.copyJson}
                  </Button>
                </Stack>
                <Box
                  component="pre"
                  sx={(muiTheme) => ({
                    m: 0,
                    p: 1.2,
                    maxHeight: 260,
                    overflow: 'auto',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    borderRadius: '8px',
                    fontSize: 12,
                    lineHeight: 1.45,
                    backgroundColor: muiTheme.palette.mode === 'dark' ? '#101114' : '#f0ece5',
                    color: muiTheme.palette.text.primary,
                  })}>
                  {lastCardFailureDebugJson}
                </Box>
              </Stack>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button
            variant="contained"
            onClick={() => {
              setCardFailureDialogOpen(false);
              void handlePayment(pendingRegisterFiscal);
            }}
            disabled={isPaymentProcessing}>
            {copy.retryFiscal}
          </Button>
          <Button variant="contained" onClick={() => void handleManualCardComplete()} disabled={isPaymentProcessing}>
            {copy.manualCard}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={renameDialogOpen}
        onClose={() => setRenameDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        fullScreen={isMobile}>
        <DialogTitle>{copy.renameOrder}</DialogTitle>
        <DialogContent>
          <Stack spacing={1.4} sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {getCashierOrderDisplayName({
                orderNumber: orderQuery.data?.orderNumber ?? 0,
                displayName: renameValue,
              })}
            </Typography>
            <TextField
              autoFocus
              label={copy.orderName}
              value={renameValue}
              onChange={(event) => {
                setRenameValue(event.target.value);
                if (renameError) {
                  setRenameError('');
                }
              }}
              placeholder={copy.orderNamePlaceholder}
              error={Boolean(renameError)}
              helperText={renameError || orderNumberLabel}
              inputProps={{ maxLength: 120 }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button
            variant="contained"
            onClick={() => setRenameDialogOpen(false)}
            sx={(muiTheme) => ({
              backgroundImage: 'none',
              backgroundColor: muiTheme.palette.mode === 'dark' ? '#4d535a' : '#d8cfbf',
              color: muiTheme.palette.mode === 'dark' ? '#f5f5f5' : muiTheme.palette.text.primary,
            })}>
            {copy.cancel}
          </Button>
          <Button
            variant="contained"
            onClick={() => void handleRenameOrder()}
            disabled={updateOrderDisplayNameMutation.isPending}>
            {copy.save}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(receiptData) && !receiptPrintPromptOpen}
        onClose={() => setReceiptData(null)}
        maxWidth="xs"
        fullWidth
        fullScreen={isMobile}>
        <DialogTitle>{copy.receiptTitle}</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ pt: 1 }}>
            <Stack direction="row" justifyContent="space-between">
              <Typography color="text.secondary">{copy.receiptNumber}</Typography>
              <Typography>
                {receiptDialogReceipts.length > 1
                  ? receiptDialogReceipts
                      .map((receipt) => receipt?.payload?.receiptNumber ?? receipt?.payload?.receipt_number)
                      .filter(Boolean)
                      .join(', ') ||
                    receiptData?.payment.externalRef ||
                    '-'
                  : (primaryReceipt?.payload?.receiptNumber ??
                    primaryReceipt?.payload?.receipt_number ??
                    receiptData?.payment.externalRef ??
                    '-')}
              </Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between">
              <Typography color="text.secondary">{copy.receiptMethod}</Typography>
              <Typography>
                {receiptData?.payment.method === 'card'
                  ? copy.card
                  : receiptData?.payment.method === 'qr'
                    ? copy.qr
                    : copy.cash}
              </Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between">
              <Typography color="text.secondary">{copy.receiptAmount}</Typography>
              <Typography>{formatCompactMoney(receiptData?.payment.amount, locale)}</Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between">
              <Typography color="text.secondary">{copy.receiptTime}</Typography>
              <Typography>
                {formatTime(
                  primaryReceipt?.payload?.issuedAt ??
                    primaryReceipt?.payload?.issued_at ??
                    receiptData?.payment.paidAt,
                  locale,
                )}
              </Typography>
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} sx={{ pt: 1 }}>
              <Button variant="contained" sx={{ flex: 1 }} onClick={() => setReceiptPrintPromptOpen(true)}>
                {copy.finishReceipt}
              </Button>
            </Stack>
          </Stack>
        </DialogContent>
      </Dialog>

      <Dialog
        open={receiptPrintPromptOpen && Boolean(receiptData)}
        onClose={() => {
          if (!isReceiptPrintConfirming) {
            setReceiptPrintPromptOpen(false);
          }
        }}
        maxWidth="xs"
        fullWidth
        fullScreen={isMobile}>
        <DialogTitle>{copy.receiptPrintPromptTitle}</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary">{copy.receiptPrintPromptBody}</Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button
            variant="contained"
            disabled={isReceiptPrintConfirming}
            sx={(muiTheme) => ({
              flex: 1,
              backgroundImage: 'none',
              backgroundColor: muiTheme.palette.mode === 'dark' ? '#4d535a' : '#d8cfbf',
              color: muiTheme.palette.mode === 'dark' ? '#f5f5f5' : muiTheme.palette.text.primary,
            })}
            onClick={finishReceiptFlow}>
            {copy.receiptPrintNo}
          </Button>
          <Button
            variant="contained"
            sx={{ flex: 1 }}
            disabled={isReceiptPrintConfirming}
            onClick={() => void handleReceiptPromptPrint()}>
            {copy.receiptPrintYes}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={paymentErrorToastOpen}
        autoHideDuration={2600}
        onClose={() => setPaymentErrorToastOpen(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Box
          sx={(muiTheme) => ({
            px: 2,
            py: 1.2,
            borderRadius: '12px',
            backgroundColor: muiTheme.palette.mode === 'dark' ? '#4c2529' : '#f6dadd',
            color: muiTheme.palette.mode === 'dark' ? '#ffe9eb' : '#8a1f2d',
            fontWeight: 700,
            boxShadow: '0 12px 28px rgba(0, 0, 0, 0.22)',
          })}>
          {paymentErrorMessage || copy.paymentFailed}
        </Box>
      </Snackbar>

      <Snackbar
        open={printToastOpen}
        autoHideDuration={2200}
        onClose={() => setPrintToastOpen(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Box
          sx={(muiTheme) => ({
            px: 2,
            py: 1.2,
            borderRadius: '12px',
            backgroundColor: muiTheme.palette.mode === 'dark' ? '#1f4a46' : '#d8efea',
            color: muiTheme.palette.mode === 'dark' ? '#d7fbf7' : '#155b54',
            fontWeight: 700,
            boxShadow: '0 12px 28px rgba(0, 0, 0, 0.22)',
          })}>
          {copy.receiptPrinted}
        </Box>
      </Snackbar>

      <PosSettingsMenu
        anchorEl={settingsAnchor}
        locale={locale}
        onClose={() => setSettingsAnchor(null)}
        onLocaleChange={setLocale}
        onRefresh={isMobile ? () => window.location.reload() : undefined}
        onShift={() => navigate(`/cashier/shift?next=${encodeURIComponent(afterPaymentPath)}`)}
        onLock={isMobile ? () => navigate('/lock-screen') : undefined}
        onThemeToggle={() => setThemeMode(themeMode === 'dark' ? 'light' : 'dark')}
        onSignOut={() => {
          setSession(null);
          void navigate('/pin-login', { replace: true });
        }}
        themeMode={themeMode}
      />
    </PosPageFrame>
  );
}
