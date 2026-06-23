import { Icon } from '@iconify/react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  IconButton,
  Pagination,
  Stack,
  TextField,
  Typography,
  alpha,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useMemo, useRef, useState, type KeyboardEvent, type TouchEvent } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';

import { canManageCashierPayments, usePosSession } from 'modules/auth';
import {
  useCashierContextQuery,
  useCashierFiscalRetryMutation,
  useCashierOpenChecksQuery,
  useCashierRefundMutation,
  useCashierReprintMutation,
  useCashierUpdateOrderDisplayNameMutation,
} from 'modules/cashier/application';
import {
  getCashierOrderDisplayName,
  getCashierOrderNumberLabel,
  groupCashierOrderItemsByStation,
} from 'modules/cashier/domain';
import type { CashierCheckStatus, CashierOrder } from 'modules/cashier/domain/entities/order.types';
import { getApiErrorMessage } from 'shared/api/errorMessage';
import { PosPageFrame } from 'shared/layout/PosPageFrame';
import { type PosLocale, formatPosCopy, getPosCopy } from 'shared/locale/copy';
import { formatCompactMoney, formatTime } from 'shared/pos/utils';
import { printReceiptWithFallback } from 'shared/printing/browserReceipt';
import { PosIconAction, PosOpenChecksSkeleton, PosSectionTabs, PosSettingsMenu } from 'shared/ui/pos-primitives';

type CashierPayment = NonNullable<CashierOrder['payments']>[number];
type RetryFiscalReceipt = { payload?: Record<string, unknown> | null };
type RetryFiscalReceiptDialogState = {
  receipts: RetryFiscalReceipt[];
  receiptNumber: string;
  methodLabel: string;
  amount: number;
};
type ChecksQueryData = { orders?: CashierOrder[]; count?: number; numPages?: number } | CashierOrder[] | undefined;
type MutationErrorPayload = {
  displayName?: string[];
  detail?: string;
};

function getChecksOrders(data: ChecksQueryData) {
  return Array.isArray(data) ? data : (data?.orders ?? []);
}

function getChecksCount(data: ChecksQueryData) {
  return Array.isArray(data) ? data.length : (data?.count ?? data?.orders?.length ?? 0);
}

function formatPercent(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');
}

function OpenChecksList({
  copy,
  locale,
  orders,
  selectedOrderId,
  selectedTab,
  onRename,
  onSelect,
  onSwipeEdit,
}: {
  copy: ReturnType<typeof getPosCopy>;
  locale: PosLocale;
  orders: CashierOrder[];
  selectedOrderId?: string;
  selectedTab: CashierCheckStatus;
  onRename: (order: CashierOrder) => void;
  onSelect: (orderId: string) => void;
  onSwipeEdit: (order: CashierOrder) => void;
}) {
  const swipeStartRef = useRef<{ orderId: string; x: number; y: number } | null>(null);
  const [swipedOrderId, setSwipedOrderId] = useState<string | null>(null);

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>, order: CashierOrder) => {
    const touch = event.touches[0];
    swipeStartRef.current = { orderId: order.id, x: touch.clientX, y: touch.clientY };
    setSwipedOrderId(null);
  };

  const handleTouchMove = (event: TouchEvent<HTMLDivElement>, order: CashierOrder) => {
    const start = swipeStartRef.current;
    const touch = event.touches[0];
    if (!start || start.orderId !== order.id || !touch) return;

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaY) > Math.abs(deltaX)) return;

    if (deltaX < -28 && selectedTab === 'open') {
      setSwipedOrderId(order.id);
    }
  };

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>, order: CashierOrder) => {
    const start = swipeStartRef.current;
    const touch = event.changedTouches[0];
    swipeStartRef.current = null;
    if (!start || start.orderId !== order.id || !touch || selectedTab !== 'open') {
      setSwipedOrderId(null);
      return;
    }

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (deltaX < -72 && Math.abs(deltaX) > Math.abs(deltaY) * 1.4) {
      onSwipeEdit(order);
      return;
    }
    setSwipedOrderId(null);
  };

  return (
    <Stack
      spacing={1.35}
      sx={{
        height: '100%',
        minHeight: 0,
        minWidth: 0,
        overflowY: 'auto',
        overflowX: 'hidden',
        pr: { xs: 0.2, md: 0.6 },
      }}>
      {orders.length > 0 ? (
        orders.map((order) => (
          <Box
            key={order.id}
            component="div"
            role="button"
            tabIndex={0}
            onTouchStart={(event) => handleTouchStart(event, order)}
            onTouchMove={(event) => handleTouchMove(event, order)}
            onTouchEnd={(event) => handleTouchEnd(event, order)}
            onClick={() => onSelect(order.id)}
            onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onSelect(order.id);
              }
            }}
            sx={(theme) => ({
              border: 0,
              width: '100%',
              textAlign: 'left',
              borderRadius: '10px',
              px: 2,
              py: 1.65,
              position: 'relative',
              cursor: 'pointer',
              color: 'inherit',
              outline: 0,
              backgroundColor:
                selectedOrderId === order.id
                  ? theme.palette.mode === 'dark'
                    ? '#343434'
                    : '#efe7db'
                  : theme.palette.mode === 'dark'
                    ? '#292929'
                    : alpha('#ffffff', 0.76),
              transform: swipedOrderId === order.id ? 'translateX(-54px)' : 'translateX(0)',
              transition: 'transform 140ms ease',
              touchAction: 'pan-y',
              '&::after': {
                content: '""',
                position: 'absolute',
                top: 0,
                right: -58,
                width: 52,
                height: '100%',
                borderRadius: '10px',
                backgroundColor: theme.palette.primary.main,
                opacity: selectedTab === 'open' && swipedOrderId === order.id ? 1 : 0,
                transition: 'opacity 140ms ease',
              },
            })}>
            {selectedTab === 'open' && swipedOrderId === order.id ? (
              <Box
                sx={{
                  position: 'absolute',
                  top: '50%',
                  right: -42,
                  transform: 'translateY(-50%)',
                  color: '#fff',
                  zIndex: 1,
                  pointerEvents: 'none',
                }}>
                <Icon icon="solar:pen-2-bold-duotone" width={22} />
              </Box>
            ) : null}
            <Stack direction="row" justifyContent="space-between" spacing={2} alignItems="center">
              <Stack direction="row" spacing={1.75} alignItems="center">
                <Box
                  sx={(theme) => ({
                    minWidth: 56,
                    height: 56,
                    borderRadius: '9px',
                    backgroundColor: theme.palette.mode === 'dark' ? '#565656' : '#d8d0c2',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 22,
                    fontWeight: 700,
                    lineHeight: 1,
                  })}>
                  {order.channel === 'delivery'
                    ? 'YD'
                    : order.channel === 'takeaway'
                      ? 'TG'
                      : (order.tableName?.match(/\d+/)?.[0] ?? '0')}
                </Box>
                <Stack spacing={0.4}>
                  <Stack direction="row" spacing={0.75} alignItems="center">
                    <Typography variant="h6">{getCashierOrderDisplayName(order)}</Typography>
                    {selectedTab === 'open' ? (
                      <IconButton
                        aria-label={copy.renameOrder}
                        onClick={(event) => {
                          event.stopPropagation();
                          onRename(order);
                        }}
                        sx={{ p: 0.4 }}>
                        <Icon icon="solar:pen-2-bold-duotone" width={18} />
                      </IconButton>
                    ) : null}
                  </Stack>
                  {order.displayName?.trim() ? (
                    <Typography variant="body2" color="text.secondary">
                      {copy.orders}: {getCashierOrderNumberLabel(order)}
                    </Typography>
                  ) : null}
                  <Typography variant="body2" color="text.secondary">
                    {order.channel === 'delivery'
                      ? copy.deliveryLabel
                      : order.channel === 'takeaway'
                        ? copy.takeawayLabel
                        : `${order.guestCount} ${copy.guests}`}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {selectedTab === 'closed' ? (order.cashierName ?? order.openedByName) : order.openedByName}
                  </Typography>
                </Stack>
              </Stack>

              <Stack spacing={0.4} alignItems="flex-end">
                <Typography variant="h6">{formatCompactMoney(order.total, locale)}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {formatTime(selectedTab === 'closed' ? (order.closedAt ?? order.createdAt) : order.createdAt, locale)}
                </Typography>
              </Stack>
            </Stack>
          </Box>
        ))
      ) : (
        <Box
          sx={(theme) => ({
            flex: 1,
            borderRadius: '14px',
            minHeight: 420,
            display: 'grid',
            placeItems: 'center',
            backgroundColor: theme.palette.mode === 'dark' ? '#252525' : alpha('#ffffff', 0.75),
          })}>
          <Typography variant="h6" color="text.secondary">
            {selectedTab === 'open'
              ? copy.noChecks
              : selectedTab === 'closed'
                ? copy.noClosedChecks
                : 'Yopilmagan hisoblar yo‘q'}
          </Typography>
        </Box>
      )}
    </Stack>
  );
}

function OpenChecksDetail({
  copy,
  groupedItems,
  latestSucceededPayment,
  locale,
  onPay,
  onRefund,
  onReprint,
  onRetryFiscal,
  order,
  receiptNumber,
  refundAvailable,
  reprintAvailable,
  retryFiscalAvailable,
  selectedTab,
}: {
  copy: ReturnType<typeof getPosCopy>;
  groupedItems: ReturnType<typeof groupCashierOrderItemsByStation>;
  latestSucceededPayment: CashierPayment | undefined;
  locale: PosLocale;
  onPay: () => void;
  onRefund: () => void;
  onReprint: () => void;
  onRetryFiscal: () => void;
  order: CashierOrder;
  receiptNumber: string | number;
  refundAvailable: boolean;
  reprintAvailable: boolean;
  retryFiscalAvailable: boolean;
  selectedTab: CashierCheckStatus;
}) {
  const serviceFeePercent = Number(order.serviceFeePercent ?? 0);
  const serviceFeeAmount = Number(order.serviceFee ?? 0);
  const serviceFeeEnabled = Boolean(order.serviceFeeEnabled ?? serviceFeePercent > 0);
  const shouldShowServiceFee = serviceFeeEnabled && (serviceFeePercent > 0 || serviceFeeAmount > 0);
  const serviceFeeLabel = `${copy.serviceFee} (${serviceFeePercent}%)`;
  const vatEnabled = Boolean(order.vatEnabled);
  const vatPercent = Number(order.vatPercent ?? 0);
  const vatAmount = Number(order.vatAmount ?? 0);
  const shouldShowVat = vatEnabled && vatPercent > 0;
  const vatLabel = `${copy.vat} (${formatPercent(vatPercent)}%)`;

  return (
    <Box
      sx={(theme) => ({
        borderRadius: '14px',
        overflow: 'hidden',
        height: '100%',
        minHeight: 0,
        backgroundColor: 'var(--pos-order-panel-bg)',
        display: 'flex',
        flexDirection: 'column',
        border: `1px solid ${alpha('#ffffff', theme.palette.mode === 'dark' ? 0.04 : 0.3)}`,
      })}>
      <Box sx={{ p: 2.5 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box
            sx={{
              minWidth: 66,
              height: 66,
              borderRadius: '10px',
              backgroundColor: 'var(--pos-order-avatar-bg)',
              display: 'grid',
              placeItems: 'center',
              fontSize: 30,
              fontWeight: 700,
            }}>
            {order.channel === 'delivery'
              ? 'YD'
              : order.channel === 'takeaway'
                ? 'TG'
                : (order.tableName?.match(/\d+/)?.[0] ?? '0')}
          </Box>

          <Stack spacing={0.25}>
            <Typography variant="h5">{getCashierOrderDisplayName(order)}</Typography>
            <Typography variant="body2" color="text.secondary">
              {copy.orders}: {getCashierOrderNumberLabel(order)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {order.channel === 'delivery'
                ? copy.deliveryLabel
                : order.channel === 'takeaway'
                  ? copy.takeawayLabel
                  : `${order.guestCount} ${copy.guests}`}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {selectedTab === 'closed' ? (order.cashierName ?? order.openedByName) : order.openedByName}
            </Typography>
          </Stack>
        </Stack>
      </Box>

      <Box sx={{ px: 2.5, pb: 2, flex: 1, overflowY: 'auto' }}>
        <Stack spacing={1.55}>
          {selectedTab === 'closed' ? (
            <Stack spacing={0.8}>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">
                  {copy.closedAt}
                </Typography>
                <Typography variant="body2">{order.closedAt ? formatTime(order.closedAt, locale) : '-'}</Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">
                  {copy.receiptMethod}
                </Typography>
                <Typography variant="body2">
                  {latestSucceededPayment?.method === 'card' ? copy.card : copy.cash}
                </Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">
                  {copy.receiptNumber}
                </Typography>
                <Typography variant="body2">{String(receiptNumber)}</Typography>
              </Stack>
            </Stack>
          ) : null}

          {groupedItems.map(([stationName, items]) => (
            <Stack key={stationName} spacing={0.9}>
              <Typography variant="body2" color="text.secondary">
                {stationName}
              </Typography>
              {items.map((item) => (
                <Box
                  key={item.id}
                  sx={{
                    borderRadius: '10px',
                    overflow: 'hidden',
                    backgroundColor: 'var(--pos-cart-item-bg)',
                  }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ p: 1.65 }}>
                    <Stack spacing={0.35} sx={{ pr: 1 }}>
                      <Typography
                        variant="subtitle1"
                        sx={{
                          textDecoration: item.status === 'cancelled' ? 'line-through' : 'none',
                          opacity: item.status === 'cancelled' ? 0.72 : 1,
                        }}>
                        {formatPosCopy(copy.itemQuantityLabel, { name: item.catalogItemName, quantity: item.quantity })}
                      </Typography>
                      {item.status === 'cancelled' ? (
                        <Typography variant="caption" sx={{ color: 'error.main', fontWeight: 700 }}>
                          {copy.cancelled}
                        </Typography>
                      ) : null}
                      {item.note ? (
                        <Typography variant="body2" color="text.secondary">
                          {item.note}
                        </Typography>
                      ) : null}
                    </Stack>
                    <Typography
                      variant="subtitle1"
                      sx={{
                        whiteSpace: 'nowrap',
                        textDecoration: item.status === 'cancelled' ? 'line-through' : 'none',
                        opacity: item.status === 'cancelled' ? 0.72 : 1,
                      }}>
                      {formatCompactMoney(item.lineTotal, locale)}
                    </Typography>
                  </Stack>
                </Box>
              ))}
            </Stack>
          ))}
        </Stack>
      </Box>

      <Divider />

      <Stack spacing={1.4} sx={{ p: 2.5 }}>
        <Stack direction="row" justifyContent="space-between">
          <Typography variant="body1" color="text.secondary">
            {copy.subtotal}:
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {formatCompactMoney(order.subtotal, locale)}
          </Typography>
        </Stack>
        {shouldShowServiceFee ? (
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="body1" color="text.secondary">
              {serviceFeeLabel}:
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {formatCompactMoney(order.serviceFee, locale)}
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
        <Stack direction="row" justifyContent="space-between" alignItems="flex-end">
          <Typography variant="h5">{copy.grandTotal}:</Typography>
          <Typography variant="h4" sx={{ lineHeight: 1.05, textAlign: 'right' }}>
            {formatCompactMoney(order.total, locale)}
          </Typography>
        </Stack>
        {selectedTab === 'open' ? (
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.1}>
            <Button variant="contained" size="large" sx={{ flex: 1.15 }} onClick={onPay}>
              {copy.pay}
            </Button>
          </Stack>
        ) : (
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.1}>
            {retryFiscalAvailable ? (
              <Button variant="contained" color="warning" sx={{ flex: 1 }} onClick={onRetryFiscal}>
                {copy.retryFiscal}
              </Button>
            ) : null}
            {reprintAvailable ? (
              <Button
                variant="contained"
                sx={(theme) => ({
                  flex: 1,
                  backgroundImage: 'none',
                  backgroundColor: 'var(--pos-secondary-action-bg)',
                  color: theme.palette.mode === 'dark' ? '#f5f5f5' : theme.palette.text.primary,
                })}
                onClick={onReprint}>
                {copy.reprintReceipt}
              </Button>
            ) : null}
            {refundAvailable ? (
              <Button variant="contained" color="error" sx={{ flex: 1 }} onClick={onRefund}>
                {copy.refund}
              </Button>
            ) : null}
          </Stack>
        )}
      </Stack>
    </Box>
  );
}

export function OpenChecksPageContent() {
  const navigate = useNavigate();
  const { session, locale, setLocale, setSession, themeColor, setThemeColor, themeMode, setThemeMode } =
    usePosSession();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const copy = getPosCopy(locale);
  const [settingsAnchor, setSettingsAnchor] = useState<HTMLElement | null>(null);
  const [selectedTab, setSelectedTab] = useState<CashierCheckStatus>('open');
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [renameOrder, setRenameOrder] = useState<CashierOrder | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState('');
  const [fiscalSearch, setFiscalSearch] = useState('');
  const [fiscalPage, setFiscalPage] = useState(1);
  const [retryReceiptDialog, setRetryReceiptDialog] = useState<RetryFiscalReceiptDialogState | null>(null);
  const [retryReceiptPrintPromptOpen, setRetryReceiptPrintPromptOpen] = useState(false);
  const [isRetryReceiptPrintConfirming, setIsRetryReceiptPrintConfirming] = useState(false);
  const refundMutation = useCashierRefundMutation();
  const reprintMutation = useCashierReprintMutation();
  const retryFiscalMutation = useCashierFiscalRetryMutation({
    onSuccess: (response) => {
      const failedResult = (response.results ?? []).find((item) => item && item.ok === false);
      if (failedResult) {
        toast.error(String(failedResult.detail ?? failedResult.message ?? 'Fiscalga qayta yuborishda xatolik bor.'));
        return;
      }
      const receipts = (
        (response.receipts?.length
          ? response.receipts
          : response.receipt
            ? [response.receipt]
            : []) as RetryFiscalReceipt[]
      ).filter(Boolean);
      setRetryReceiptDialog({
        receipts,
        receiptNumber:
          receipts
            .map((receipt) => receipt.payload?.receiptNumber ?? receipt.payload?.receipt_number)
            .filter(Boolean)
            .join(', ') ||
          latestSucceededPayment?.id ||
          '-',
        methodLabel:
          latestSucceededPayment?.method === 'card'
            ? copy.card
            : latestSucceededPayment?.method === 'qr'
              ? copy.qr
              : copy.cash,
        amount: Number(latestSucceededPayment?.amount ?? 0),
      });
      toast.success('Fiscalga qayta yuborildi');
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Fiscalga qayta yuborishda xatolik bor.')),
  });
  const updateOrderDisplayNameMutation = useCashierUpdateOrderDisplayNameMutation({
    onSuccess: () => {
      setRenameOrder(null);
      setRenameError('');
    },
  });

  const openOrdersQuery = useCashierOpenChecksQuery('open');
  const closedOrdersQuery = useCashierOpenChecksQuery('closed');
  const cashierContextQuery = useCashierContextQuery();
  const fiscalUnresolvedQuery = useCashierOpenChecksQuery('fiscal_unresolved', {
    search: fiscalSearch,
    page: fiscalPage,
    pageSize: 25,
  });
  const selectedCashDesk = useMemo(() => {
    const cashDesks = cashierContextQuery.data?.availableCashDesks ?? [];
    const activeCashDeskId = cashierContextQuery.data?.currentShift?.cashDesk;
    return cashDesks.find((cashDesk) => cashDesk.id === activeCashDeskId) ?? cashDesks[0] ?? null;
  }, [cashierContextQuery.data?.availableCashDesks, cashierContextQuery.data?.currentShift?.cashDesk]);
  const receiptLocalAgentEnabled = true;
  const receiptPrintOptions = useMemo(
    () => ({
      preferLocalAgent: receiptLocalAgentEnabled,
      ...(selectedCashDesk?.printerIntegrationPrinterName
        ? { printerName: selectedCashDesk.printerIntegrationPrinterName }
        : {}),
      ...(selectedCashDesk?.printerIntegrationConnectionType
        ? { connectionType: selectedCashDesk.printerIntegrationConnectionType }
        : {}),
      ...(selectedCashDesk?.printerIntegrationHost ? { host: selectedCashDesk.printerIntegrationHost } : {}),
      ...(selectedCashDesk?.printerIntegrationPort ? { port: selectedCashDesk.printerIntegrationPort } : {}),
    }),
    [
      receiptLocalAgentEnabled,
      selectedCashDesk?.printerIntegrationConnectionType,
      selectedCashDesk?.printerIntegrationHost,
      selectedCashDesk?.printerIntegrationPort,
      selectedCashDesk?.printerIntegrationPrinterName,
    ],
  );
  const isInitialLoading =
    openOrdersQuery.isLoading && closedOrdersQuery.isLoading && !openOrdersQuery.data && !closedOrdersQuery.data;
  const openOrders = useMemo(() => getChecksOrders(openOrdersQuery.data), [openOrdersQuery.data]);
  const closedOrders = useMemo(() => getChecksOrders(closedOrdersQuery.data), [closedOrdersQuery.data]);
  const fiscalUnresolvedOrders = useMemo(
    () => getChecksOrders(fiscalUnresolvedQuery.data),
    [fiscalUnresolvedQuery.data],
  );
  const visibleOrders =
    selectedTab === 'open' ? openOrders : selectedTab === 'closed' ? closedOrders : fiscalUnresolvedOrders;
  const selectedOrder =
    visibleOrders.find((order) => order.id === selectedOrderId) ?? (isMobile ? undefined : visibleOrders[0]);
  const groupedItems = useMemo(
    () => groupCashierOrderItemsByStation(selectedOrder?.items, copy.menu),
    [copy.menu, selectedOrder?.items],
  );
  const latestSucceededPayment = useMemo(() => {
    const succeededPayments = [...(selectedOrder?.payments ?? [])].filter((payment) => payment.status === 'succeeded');

    return succeededPayments[succeededPayments.length - 1];
  }, [selectedOrder?.payments]);
  const latestReceipt = useMemo(() => {
    const receipts = selectedOrder?.receipts ?? [];
    return receipts[receipts.length - 1];
  }, [selectedOrder?.receipts]);
  const canOperatePayments = canManageCashierPayments(session?.user);
  const receiptNumber = useMemo(() => {
    const payload = latestReceipt?.payload as Record<string, unknown> | undefined;
    const rawReceiptNumber = payload?.receiptNumber ?? payload?.receipt_number;

    return typeof rawReceiptNumber === 'string' || typeof rawReceiptNumber === 'number'
      ? rawReceiptNumber
      : (latestSucceededPayment?.id ?? copy.receiptUnavailable);
  }, [copy.receiptUnavailable, latestReceipt?.payload, latestSucceededPayment?.id]);
  const canRefund = Boolean(
    selectedTab === 'closed' && latestSucceededPayment?.id && !latestSucceededPayment?.isRefunded && canOperatePayments,
  );
  const canReprint = Boolean(selectedTab === 'closed' && latestReceipt?.id && canOperatePayments);
  const canRetryFiscal = Boolean(
    selectedTab === 'fiscal_unresolved' && latestSucceededPayment?.id && canOperatePayments,
  );
  const renameOrderNumberLabel = renameOrder ? getCashierOrderNumberLabel(renameOrder) : copy.orders;
  const renameOrderPreview = renameOrder
    ? getCashierOrderDisplayName({ orderNumber: renameOrder.orderNumber, displayName: renameValue })
    : copy.orders;

  const finishRetryReceiptFlow = () => {
    setRetryReceiptPrintPromptOpen(false);
    setRetryReceiptDialog(null);
    setSelectedOrderId('');
    void fiscalUnresolvedQuery.refetch();
  };

  const handleRetryReceiptPromptPrint = async () => {
    if (isRetryReceiptPrintConfirming) {
      return;
    }

    setIsRetryReceiptPrintConfirming(true);
    try {
      await Promise.all(
        (retryReceiptDialog?.receipts ?? []).map((receipt) =>
          printReceiptWithFallback(receipt.payload ?? null, {
            ...receiptPrintOptions,
            receiptId: receipt.id,
          }),
        ),
      );
    } catch {
      // Keep the cashier flow moving even if the browser blocks a print window.
    } finally {
      setIsRetryReceiptPrintConfirming(false);
      finishRetryReceiptFlow();
    }
  };

  const handleOpenRenameDialog = (order: CashierOrder) => {
    setRenameOrder(order);
    setRenameValue(order.displayName?.trim() ?? '');
    setRenameError('');
  };

  const handleRenameSave = async () => {
    if (!renameOrder) {
      return;
    }

    try {
      await updateOrderDisplayNameMutation.mutateAsync({
        orderId: renameOrder.id,
        displayName: renameValue.trim(),
      });
    } catch (error) {
      const errorResponse = (error as { response?: { data?: MutationErrorPayload } })?.response?.data;
      setRenameError(errorResponse?.displayName?.[0] ?? errorResponse?.detail ?? copy.renameOrderFailed);
    }
  };

  const detailPanel = selectedOrder ? (
    <OpenChecksDetail
      copy={copy}
      groupedItems={groupedItems}
      latestSucceededPayment={latestSucceededPayment}
      locale={locale}
      onPay={() => navigate(`/cashier/payment?orderId=${selectedOrder.id}`)}
      onRefund={() => {
        if (!latestSucceededPayment?.id || refundMutation.isPending) {
          return;
        }
        refundMutation.mutate({ paymentId: latestSucceededPayment.id });
      }}
      onReprint={() => {
        if (!latestReceipt?.id || reprintMutation.isPending) {
          return;
        }
        reprintMutation
          .mutateAsync(latestReceipt.id)
          .then((response) => {
            const result = response.result ?? {};
            const code = String(result.code ?? '');
            if (code === 'PRINTER_NOT_CONFIGURED') {
              toast.info('Printer sozlamalari ulanmagan');
              void printReceiptWithFallback(response.receipt?.payload ?? latestReceipt.payload ?? null, {
                ...receiptPrintOptions,
                receiptId: response.receipt?.id ?? latestReceipt.id,
              });
              return;
            }
            if (code === 'PRINTER_UNAVAILABLE' || result.ok === false) {
              toast.info('Printer ishlamayapti');
              void printReceiptWithFallback(response.receipt?.payload ?? latestReceipt.payload ?? null, {
                ...receiptPrintOptions,
                receiptId: response.receipt?.id ?? latestReceipt.id,
              });
              return;
            }
            void printReceiptWithFallback(response.receipt?.payload ?? latestReceipt.payload ?? null, {
              ...receiptPrintOptions,
              receiptId: response.receipt?.id ?? latestReceipt.id,
            });
          })
          .catch(() => {
            toast.info('Printer ishlamayapti');
            void printReceiptWithFallback(latestReceipt.payload ?? null, {
              ...receiptPrintOptions,
              receiptId: latestReceipt.id,
            });
          });
      }}
      onRetryFiscal={() => {
        if (!latestSucceededPayment?.id || retryFiscalMutation.isPending) {
          return;
        }
        retryFiscalMutation.mutate(latestSucceededPayment.id);
      }}
      order={selectedOrder}
      receiptNumber={receiptNumber}
      refundAvailable={canRefund}
      reprintAvailable={canReprint}
      retryFiscalAvailable={canRetryFiscal}
      selectedTab={selectedTab}
    />
  ) : null;

  const handleSwipeEdit = (order: CashierOrder) => {
    const channel = order.channel === 'delivery' ? 'delivery' : 'takeaway';
    void navigate(`/cashier/builder?orderId=${order.id}&channel=${channel}`);
  };

  if (isInitialLoading) {
    return <PosOpenChecksSkeleton mobile={isMobile} />;
  }

  return (
    <PosPageFrame
      header={
        <Stack direction="row" spacing={1.5} justifyContent="space-between" alignItems="center">
          <PosSectionTabs
            value={selectedTab}
            onChange={(value) => {
              setSelectedTab(value as CashierCheckStatus);
              if (isMobile) {
                setMobileDetailOpen(false);
              }
            }}
            items={[
              { value: 'open', label: `${copy.openChecks} (${openOrders.length})` },
              { value: 'closed', label: `${copy.closedChecks} (${closedOrders.length})` },
              {
                value: 'fiscal_unresolved',
                label: `Yopilmagan hisoblar (${getChecksCount(fiscalUnresolvedQuery.data)})`,
              },
            ]}
          />

          <Stack direction="row" spacing={1.5}>
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
      {selectedTab === 'fiscal_unresolved' ? (
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={1.2}
          alignItems={{ xs: 'stretch', md: 'center' }}
          sx={{ mb: 1.5 }}>
          <TextField
            size="small"
            placeholder="Qidirish"
            value={fiscalSearch}
            onChange={(event) => {
              setFiscalSearch(event.target.value);
              setFiscalPage(1);
            }}
            sx={{ maxWidth: { md: 360 } }}
          />
          <Box sx={{ flex: 1 }} />
          <Pagination
            count={Math.max(
              1,
              Array.isArray(fiscalUnresolvedQuery.data) ? 1 : (fiscalUnresolvedQuery.data?.numPages ?? 1),
            )}
            page={fiscalPage}
            onChange={(_, page) => setFiscalPage(page)}
            shape="rounded"
          />
        </Stack>
      ) : null}

      {isMobile ? (
        <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <OpenChecksList
            copy={copy}
            locale={locale}
            orders={visibleOrders}
            selectedOrderId={selectedOrderId}
            selectedTab={selectedTab}
            onRename={handleOpenRenameDialog}
            onSwipeEdit={handleSwipeEdit}
            onSelect={(orderId) => {
              setSelectedOrderId(orderId);
              setMobileDetailOpen(true);
            }}
          />
        </Box>
      ) : (
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              md: 'minmax(0, 1fr) clamp(320px, 34vw, 370px)',
              xl: 'minmax(0, 1fr) clamp(380px, 24vw, 430px)',
            },
            gap: { xs: 1.5, md: 1.6, xl: 2.4 },
          }}>
          <OpenChecksList
            copy={copy}
            locale={locale}
            orders={visibleOrders}
            selectedOrderId={selectedOrder?.id}
            selectedTab={selectedTab}
            onRename={handleOpenRenameDialog}
            onSwipeEdit={handleSwipeEdit}
            onSelect={setSelectedOrderId}
          />
          <Box sx={{ minHeight: 0 }}>{detailPanel}</Box>
        </Box>
      )}

      <Drawer
        anchor="bottom"
        open={isMobile && mobileDetailOpen && Boolean(detailPanel)}
        onClose={() => setMobileDetailOpen(false)}
        PaperProps={{
          sx: {
            height: 'min(82dvh, 860px)',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            backgroundImage: 'none',
            overflow: 'hidden',
          },
        }}>
        <Stack sx={{ height: '100%', minHeight: 0 }}>
          <Stack
            direction="row"
            spacing={1.2}
            alignItems="center"
            justifyContent="space-between"
            sx={{ px: 2, py: 1.5 }}>
            <Stack spacing={0.25}>
              <Typography variant="h6">{copy.bills}</Typography>
              <Typography variant="body2" color="text.secondary">
                {selectedOrder ? getCashierOrderDisplayName(selectedOrder) : copy.orders}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {selectedOrder ? getCashierOrderNumberLabel(selectedOrder) : copy.orders}
              </Typography>
            </Stack>
            <PosIconAction icon="solar:close-circle-bold-duotone" onClick={() => setMobileDetailOpen(false)} />
          </Stack>
          <Box sx={{ flex: 1, minHeight: 0, px: 2, pb: 2 }}>{detailPanel}</Box>
        </Stack>
      </Drawer>

      <Dialog
        open={Boolean(retryReceiptDialog) && !retryReceiptPrintPromptOpen}
        onClose={() => setRetryReceiptDialog(null)}
        maxWidth="xs"
        fullWidth
        fullScreen={isMobile}>
        <DialogTitle>{copy.receiptTitle}</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ pt: 1 }}>
            <Stack direction="row" justifyContent="space-between">
              <Typography color="text.secondary">{copy.receiptNumber}</Typography>
              <Typography>{retryReceiptDialog?.receiptNumber ?? '-'}</Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between">
              <Typography color="text.secondary">{copy.receiptMethod}</Typography>
              <Typography>{retryReceiptDialog?.methodLabel ?? '-'}</Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between">
              <Typography color="text.secondary">{copy.receiptAmount}</Typography>
              <Typography>{formatCompactMoney(retryReceiptDialog?.amount ?? 0, locale)}</Typography>
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} sx={{ pt: 1 }}>
              <Button variant="contained" sx={{ flex: 1 }} onClick={() => setRetryReceiptPrintPromptOpen(true)}>
                {copy.finishReceipt}
              </Button>
            </Stack>
          </Stack>
        </DialogContent>
      </Dialog>

      <Dialog
        open={retryReceiptPrintPromptOpen && Boolean(retryReceiptDialog)}
        onClose={() => {
          if (!isRetryReceiptPrintConfirming) {
            setRetryReceiptPrintPromptOpen(false);
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
            disabled={isRetryReceiptPrintConfirming}
            sx={(theme) => ({
              flex: 1,
              backgroundImage: 'none',
              backgroundColor: 'var(--pos-secondary-action-bg)',
              color: theme.palette.mode === 'dark' ? '#f5f5f5' : theme.palette.text.primary,
            })}
            onClick={finishRetryReceiptFlow}>
            {copy.receiptPrintNo}
          </Button>
          <Button
            variant="contained"
            sx={{ flex: 1 }}
            disabled={isRetryReceiptPrintConfirming}
            onClick={() => void handleRetryReceiptPromptPrint()}>
            {copy.receiptPrintYes}
          </Button>
        </DialogActions>
      </Dialog>

      <PosSettingsMenu
        anchorEl={settingsAnchor}
        locale={locale}
        onClose={() => setSettingsAnchor(null)}
        onLocaleChange={setLocale}
        onRefresh={isMobile ? () => window.location.reload() : undefined}
        onShift={() => navigate('/cashier/shift?next=/cashier/open-checks')}
        onLock={isMobile ? () => navigate('/lock-screen') : undefined}
        onThemeToggle={() => setThemeMode(themeMode === 'dark' ? 'light' : 'dark')}
        onThemeColorChange={setThemeColor}
        onSignOut={() => {
          setSession(null);
          void navigate('/pin-login', { replace: true });
        }}
        themeColor={themeColor}
        themeMode={themeMode}
      />

      <Dialog
        open={Boolean(renameOrder)}
        onClose={() => setRenameOrder(null)}
        maxWidth="xs"
        fullWidth
        fullScreen={isMobile}>
        <DialogTitle>{copy.renameOrder}</DialogTitle>
        <DialogContent>
          <Stack spacing={1.4} sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {renameOrderPreview}
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
              helperText={renameError || renameOrderNumberLabel}
              inputProps={{ maxLength: 120 }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button
            variant="contained"
            onClick={() => setRenameOrder(null)}
            sx={(theme) => ({
              backgroundImage: 'none',
              backgroundColor: 'var(--pos-secondary-action-bg)',
              color: theme.palette.mode === 'dark' ? '#f5f5f5' : theme.palette.text.primary,
            })}>
            {copy.cancel}
          </Button>
          <Button
            variant="contained"
            onClick={() => void handleRenameSave()}
            disabled={updateOrderDisplayNameMutation.isPending}>
            {copy.save}
          </Button>
        </DialogActions>
      </Dialog>
    </PosPageFrame>
  );
}
