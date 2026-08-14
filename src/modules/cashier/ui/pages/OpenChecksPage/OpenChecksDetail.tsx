import { Box, Button, Divider, Stack, Typography, alpha } from '@mui/material';

import {
  getCashierOrderDisplayName,
  getCashierOrderNumberLabel,
  groupCashierOrderItemsByStation,
} from 'modules/cashier/domain';
import type { CashierCheckStatus, CashierOrder } from 'modules/cashier/domain/entities/order.types';
import { type PosLocale, formatPosCopy, getPosCopy } from 'shared/locale/copy';
import { getPosTableNumberLabel, getPosZoneContextLabel } from 'shared/pos/orderLocation';
import { formatCompactMoney, formatTime } from 'shared/pos/utils';

type CashierPayment = NonNullable<CashierOrder['payments']>[number];

function formatPercent(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');
}

export function OpenChecksDetail({
  copy,
  groupedItems,
  latestSucceededPayment,
  locale,
  onPay,
  onPrintPrecheck,
  onRefund,
  onReprint,
  onRetryFiscal,
  order,
  precheckAvailable,
  precheckPending,
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
  onPrintPrecheck: () => void;
  onRefund: () => void;
  onReprint: () => void;
  onRetryFiscal: () => void;
  order: CashierOrder;
  precheckAvailable: boolean;
  precheckPending: boolean;
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
            {order.channel === 'delivery' ? 'YD' : order.channel === 'takeaway' ? 'TG' : getPosTableNumberLabel(order)}
          </Box>

          <Stack spacing={0.25}>
            <Typography variant="h5">{getCashierOrderDisplayName(order)}</Typography>
            <Typography variant="body2" color="text.secondary">
              {copy.orders}: {getCashierOrderNumberLabel(order)}
            </Typography>
            {getPosZoneContextLabel(order) ? (
              <Typography variant="body2" color="text.secondary" noWrap title={getPosZoneContextLabel(order)}>
                {getPosZoneContextLabel(order)}
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
            <Button
              variant="contained"
              size="large"
              disabled={!precheckAvailable || precheckPending}
              sx={(theme) => ({
                flex: 1,
                backgroundImage: 'none',
                backgroundColor: 'var(--pos-secondary-action-bg)',
                color: theme.palette.mode === 'dark' ? '#f5f5f5' : theme.palette.text.primary,
              })}
              onClick={onPrintPrecheck}>
              {precheckPending ? copy.processing : copy.printPrecheck}
            </Button>
            <Button variant="contained" size="large" sx={{ flex: 1.15 }} disabled={precheckPending} onClick={onPay}>
              {copy.pay}
            </Button>
          </Stack>
        ) : (
          <Stack spacing={1.1}>
            {retryFiscalAvailable || reprintAvailable ? (
              <Stack direction="row" spacing={1.1}>
                {retryFiscalAvailable ? (
                  <Button variant="contained" color="warning" fullWidth sx={{ flex: 1 }} onClick={onRetryFiscal}>
                    {copy.fiscalClose}
                  </Button>
                ) : null}
                {reprintAvailable ? (
                  <Button
                    variant="contained"
                    fullWidth
                    sx={(theme) => ({
                      flex: 1,
                      backgroundImage: 'none',
                      backgroundColor: 'var(--pos-secondary-action-bg)',
                      color: theme.palette.mode === 'dark' ? '#f5f5f5' : theme.palette.text.primary,
                    })}
                    onClick={onReprint}>
                    {selectedTab === 'closed' ? copy.reprintPrecheck : copy.reprintReceipt}
                  </Button>
                ) : null}
              </Stack>
            ) : null}
            {refundAvailable ? (
              <Button variant="contained" color="error" fullWidth onClick={onRefund}>
                {copy.refund}
              </Button>
            ) : null}
          </Stack>
        )}
      </Stack>
    </Box>
  );
}
