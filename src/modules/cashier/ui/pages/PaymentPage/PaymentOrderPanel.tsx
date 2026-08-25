import { Icon } from '@iconify/react';
import { Box, IconButton, Stack, Typography, alpha } from '@mui/material';

import type { AggregatedCashierOrderItem, CashierOrder } from 'modules/cashier/domain';
import { getPosCopy, type PosLocale } from 'shared/locale/copy';
import { getPosOrderLocationLabel, getPosTableNumberLabel } from 'shared/pos/orderLocation';
import { formatCompactMoney, formatPosItemQuantityLabel } from 'shared/pos/utils';

type PaymentOrderPanelProps = {
  addingItemId: string | null;
  addPending: boolean;
  canAddItems: boolean;
  canRemoveItems: boolean;
  copy: ReturnType<typeof getPosCopy>;
  hasCustomOrderName: boolean;
  items: AggregatedCashierOrderItem[];
  locale: PosLocale;
  onAddItem: (item: AggregatedCashierOrderItem) => void;
  onRemoveItem: (itemId: string) => void;
  onRename: () => void;
  order?: CashierOrder;
  orderDisplayName: string;
  orderNumberLabel: string;
  removePending: boolean;
  removingItemId: string | null;
};

function orderAvatar(order?: CashierOrder) {
  if (order?.channel === 'delivery') {
    return 'YD';
  }
  if (order?.channel === 'takeaway') {
    return 'TG';
  }
  return getPosTableNumberLabel(order);
}

function orderLocation(order: CashierOrder | undefined, copy: ReturnType<typeof getPosCopy>) {
  if (order?.channel === 'delivery') {
    return copy.deliveryLabel;
  }
  if (order?.channel === 'takeaway') {
    return copy.takeawayLabel;
  }
  return getPosOrderLocationLabel(order) || copy.hallLabel;
}

export function PaymentOrderPanel({
  addingItemId,
  addPending,
  canAddItems,
  canRemoveItems,
  copy,
  hasCustomOrderName,
  items,
  locale,
  onAddItem,
  onRemoveItem,
  onRename,
  order,
  orderDisplayName,
  orderNumberLabel,
  removePending,
  removingItemId,
}: PaymentOrderPanelProps) {
  return (
    <Box
      sx={(theme) => ({
        borderRadius: '14px',
        backgroundColor: 'var(--pos-content-panel-bg)',
        p: { xs: 1.8, md: 2.4 },
        border: `1px solid ${alpha('#ffffff', theme.palette.mode === 'dark' ? 0.04 : 0.28)}`,
        minHeight: 0,
        overflowY: { xs: 'visible', md: 'auto' },
        overflowX: 'hidden',
      })}>
      <Stack spacing={2}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box
            sx={{
              minWidth: { xs: 56, md: 62 },
              height: { xs: 56, md: 62 },
              borderRadius: '10px',
              backgroundColor: 'var(--pos-order-avatar-bg)',
              display: 'grid',
              placeItems: 'center',
              fontSize: 28,
              fontWeight: 700,
            }}>
            {orderAvatar(order)}
          </Box>
          <Stack spacing={0.25}>
            <Stack direction="row" spacing={0.75} alignItems="center">
              <Typography variant="h5">{orderDisplayName}</Typography>
              <IconButton aria-label={copy.renameOrder} onClick={onRename} sx={{ p: 0.4 }}>
                <Icon icon="solar:pen-2-bold-duotone" width={18} />
              </IconButton>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              {hasCustomOrderName ? `${copy.orders}: ${orderNumberLabel}` : copy.orders}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {orderLocation(order, copy)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {order?.openedByName}
            </Typography>
          </Stack>
        </Stack>

        <Stack spacing={1.15}>
          {items.map((item) => (
            <Box
              key={item.key}
              sx={{
                borderRadius: '10px',
                overflow: 'hidden',
                backgroundColor: 'var(--pos-payment-item-bg)',
              }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1.2} sx={{ p: 1.65 }}>
                <Stack spacing={0.35} sx={{ minWidth: 0, flex: 1 }}>
                  <Typography
                    variant="subtitle1"
                    sx={{
                      textDecoration: item.status === 'cancelled' ? 'line-through' : 'none',
                      opacity: item.status === 'cancelled' ? 0.72 : 1,
                    }}>
                    {formatPosItemQuantityLabel(item.catalogItemName, item.quantity, item.saleUnit, locale)}
                  </Typography>
                  {item.modifiers?.map((modifier) => (
                    <Typography
                      key={`${modifier.groupName}-${modifier.optionName}`}
                      variant="body2"
                      color="text.secondary">
                      • {modifier.groupName}: {modifier.optionName}
                      {Number(modifier.priceDelta)
                        ? ` (+${formatCompactMoney(Number(modifier.priceDelta), locale)})`
                        : ''}
                    </Typography>
                  ))}
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
                  {item.status !== 'cancelled' && (canAddItems || canRemoveItems) ? (
                    <Stack direction="row" spacing={0.4}>
                      {canRemoveItems ? (
                        <IconButton
                          aria-label={copy.removeOne}
                          disabled={removePending}
                          onClick={() => onRemoveItem(item.id)}>
                          <Icon
                            icon={
                              removePending && removingItemId === item.id
                                ? 'solar:refresh-bold'
                                : 'solar:minus-circle-bold'
                            }
                            width={20}
                          />
                        </IconButton>
                      ) : null}
                      {canAddItems ? (
                        <IconButton aria-label={copy.addOneMore} disabled={addPending} onClick={() => onAddItem(item)}>
                          <Icon
                            icon={
                              addPending && addingItemId === item.id ? 'solar:refresh-bold' : 'solar:add-circle-bold'
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
  );
}
