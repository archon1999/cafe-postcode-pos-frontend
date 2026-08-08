import { Icon } from '@iconify/react';
import { Box, Button, Divider, Stack, TextField, Typography, alpha } from '@mui/material';

import type { WaiterMenuItem } from 'modules/waiter/domain';
import type { PosLocale, getPosCopy } from 'shared/locale/copy';
import { formatCompactMoney } from 'shared/pos/utils';
import { PosOrderChannelSegment } from 'shared/ui/pos-primitives';
import type { PosCartItemGroupsProps } from 'shared/ui/pos-primitives/PosCartItemGroups';
import { PosCartItemGroups } from 'shared/ui/pos-primitives/PosCartItemGroups';

export type TableSessionDesktopCartProps = {
  avatarLabel: string;
  canTakePayment: boolean;
  channel: string;
  copy: ReturnType<typeof getPosCopy>;
  groups: PosCartItemGroupsProps<WaiterMenuItem>['groups'];
  isSubmitDisabled: boolean;
  isCheckoutDisabled: boolean;
  isSubmitting: boolean;
  isTakeawayMode: boolean;
  pendingItemCount: number;
  readyItemCount: number;
  isServingReady: boolean;
  kitchenNote: string;
  locale: PosLocale;
  menuItems: ReadonlyMap<string, WaiterMenuItem>;
  operatorName: string;
  orderLabel: string;
  orderModeMeta: string;
  orderSent: boolean;
  selectedItemKey: string | null;
  serviceFee: number | string | undefined;
  serviceFeeLabel: string;
  showServiceFee: boolean;
  showVat: boolean;
  subtotal: number | string | undefined;
  total: number | string | undefined;
  vatAmount: number;
  vatLabel: string;
  onAdd: PosCartItemGroupsProps<WaiterMenuItem>['onAdd'];
  onCheckout: () => void;
  onKitchenNoteChange: (value: string) => void;
  onRemove: (itemId: string) => void;
  onSelect: (key: string) => void;
  onSubmit: () => void;
  onServeReady: () => void;
};

function getWaiterItemStatusLabel(props: TableSessionDesktopCartProps) {
  return (item: Parameters<NonNullable<PosCartItemGroupsProps<WaiterMenuItem>['getStatusLabel']>>[0]) => {
    if (!item.kitchenDispatched) return props.copy.kitchenDraft;
    if (item.status === 'cooking') return props.copy.kitchenCooking;
    if (item.status === 'done') return props.copy.kitchenReady;
    if (item.status === 'served') return props.copy.kitchenServed;
    if (item.status === 'cancelled') return props.copy.kitchenCancelled;
    return props.copy.kitchenQueued;
  };
}

export function TableSessionActions(props: TableSessionDesktopCartProps) {
  if (!props.isTakeawayMode) {
    return (
      <Button variant="contained" sx={{ flex: 1 }} disabled={props.isSubmitDisabled} onClick={props.onSubmit}>
        {props.isSubmitting ? props.copy.processing : `${props.copy.sendOrder} · ${props.pendingItemCount}`}
      </Button>
    );
  }

  return (
    <>
      <Button
        variant="contained"
        sx={(theme) => ({
          flex: 1,
          backgroundImage: 'none',
          backgroundColor: theme.palette.mode === 'dark' ? '#464646' : '#d7cebf',
          color: theme.palette.mode === 'dark' ? '#f5f5f5' : theme.palette.text.primary,
        })}
        disabled={props.isSubmitDisabled}
        onClick={props.onSubmit}>
        {props.isSubmitting ? props.copy.processing : `${props.copy.sendOrder} · ${props.pendingItemCount}`}
      </Button>
      <Button variant="contained" sx={{ flex: 1.15 }} disabled={props.isCheckoutDisabled} onClick={props.onCheckout}>
        {props.canTakePayment ? props.copy.goToPayment : props.copy.sendToCashier}
      </Button>
    </>
  );
}

export function TableSessionDesktopCart(props: TableSessionDesktopCartProps) {
  return (
    <Box
      sx={(theme) => ({
        display: { xs: 'none', md: 'flex' },
        borderRadius: '14px',
        overflow: 'hidden',
        height: '100%',
        minHeight: 0,
        backgroundColor: 'var(--pos-order-panel-bg)',
        flexDirection: 'column',
        border: `1px solid ${alpha('#ffffff', theme.palette.mode === 'dark' ? 0.04 : 0.3)}`,
      })}>
      <Box sx={{ p: 2.5 }}>
        <Stack spacing={1.7}>
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
                lineHeight: 1,
              }}>
              {props.avatarLabel}
            </Box>
            <Stack spacing={0.45} sx={{ minWidth: 0 }}>
              <Typography variant="body1" color="text.secondary">
                {props.copy.orders}: {props.orderLabel}
              </Typography>
              <Stack direction="row" spacing={1.4} alignItems="center" useFlexGap flexWrap="wrap">
                <Stack direction="row" spacing={0.7} alignItems="center" minWidth={0}>
                  <Icon icon="solar:user-rounded-bold-duotone" width={18} />
                  <Typography variant="body2" color="text.secondary" noWrap>
                    {props.orderModeMeta}
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={0.7} alignItems="center" minWidth={0}>
                  <Icon icon="solar:plate-bold-duotone" width={18} />
                  <Typography variant="body2" color="text.secondary" noWrap>
                    {props.operatorName}
                  </Typography>
                </Stack>
              </Stack>
            </Stack>
          </Stack>
          <PosOrderChannelSegment
            takeawayLabel={props.copy.takeaway}
            channel={props.channel}
            items={[
              { value: 'hall', label: props.copy.hall },
              { value: 'takeaway', label: props.copy.takeawaySwitch },
              { value: 'delivery', label: props.copy.deliverySwitch },
            ]}
          />
        </Stack>
      </Box>

      <Box sx={{ px: 2.5, pb: 2, flex: 1, overflowY: 'auto' }}>
        <Stack spacing={1.6}>
          {props.groups.length > 0 ? (
            <PosCartItemGroups
              groups={props.groups}
              itemQuantityLabel={props.copy.itemQuantityLabel}
              locale={props.locale}
              menuItems={props.menuItems}
              onAdd={props.onAdd}
              onRemove={props.onRemove}
              onSelect={props.onSelect}
              selectedItemKey={props.selectedItemKey}
              variant="desktop"
              getStatusLabel={getWaiterItemStatusLabel(props)}
            />
          ) : (
            <Stack sx={{ py: 14, textAlign: 'center' }} spacing={1}>
              <Typography variant="h6">{props.copy.emptyOrder}</Typography>
              <Typography variant="body1" color="text.secondary">
                {props.copy.chooseFromMenu}
              </Typography>
            </Stack>
          )}
        </Stack>
      </Box>

      <Divider />
      <Stack spacing={1.5} sx={{ p: 2.5 }}>
        {!props.isTakeawayMode && props.readyItemCount > 0 ? (
          <Button
            variant="outlined"
            color="success"
            disabled={props.isServingReady}
            onClick={props.onServeReady}
            startIcon={<Icon icon="solar:check-read-bold-duotone" width={20} />}>
            {props.isServingReady
              ? props.copy.servingReadyItems
              : `${props.copy.serveReadyItems} · ${props.readyItemCount}`}
          </Button>
        ) : null}
        {props.orderSent || (props.groups.length > 0 && props.pendingItemCount === 0) ? (
          <Box
            sx={(theme) => ({
              borderRadius: '10px',
              px: 1.4,
              py: 1.1,
              backgroundColor: theme.palette.mode === 'dark' ? alpha('#24c5bf', 0.12) : alpha('#1384ef', 0.08),
              border: `1px solid ${alpha(theme.palette.primary.main, 0.24)}`,
            })}>
            <Typography variant="body2">
              {props.orderSent ? props.copy.orderSent : props.copy.allKitchenItemsSent}
            </Typography>
          </Box>
        ) : null}
        <TextField
          label={props.copy.kitchenNote}
          value={props.kitchenNote}
          onChange={(event) => props.onKitchenNoteChange(event.target.value)}
          multiline
          minRows={1}
        />
        <Stack direction="row" justifyContent="space-between">
          <Typography variant="body1" color="text.secondary">
            {props.copy.subtotal}:
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {formatCompactMoney(props.subtotal, props.locale)}
          </Typography>
        </Stack>
        {props.showServiceFee ? (
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="body1" color="text.secondary">
              {props.serviceFeeLabel}:
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {formatCompactMoney(props.serviceFee, props.locale)}
            </Typography>
          </Stack>
        ) : null}
        {props.showVat ? (
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="body1" color="text.secondary">
              {props.vatLabel}:
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {formatCompactMoney(props.vatAmount, props.locale)}
            </Typography>
          </Stack>
        ) : null}
        <Stack direction="row" justifyContent="space-between" alignItems="flex-end">
          <Typography variant="h5">{props.copy.grandTotal}:</Typography>
          <Typography variant="h4" sx={{ lineHeight: 1.05, textAlign: 'right' }}>
            {formatCompactMoney(props.total, props.locale)}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1.2}>
          <TableSessionActions {...props} />
        </Stack>
      </Stack>
    </Box>
  );
}
