import { Box, Button, Divider, Drawer, Stack, TextField, Typography, alpha, useMediaQuery } from '@mui/material';

import type { CashierMenuItem } from 'modules/cashier/domain';
import type { PosLocale, getPosCopy } from 'shared/locale/copy';
import { PosIconAction, PosOrderChannelSegment } from 'shared/ui/pos-primitives';
import type { PosCartItemGroupsProps } from 'shared/ui/pos-primitives/PosCartItemGroups';
import { PosCartItemGroups } from 'shared/ui/pos-primitives/PosCartItemGroups';

import { CashierOrderTotals } from './CashierOrderTotals';

type Channel = 'hall' | 'delivery' | 'takeaway';

type CartProps = {
  channel: Channel;
  channelSwitchDisabled: boolean;
  copy: ReturnType<typeof getPosCopy>;
  currentOrderLabel: string;
  groups: PosCartItemGroupsProps<CashierMenuItem>['groups'];
  isSubmitDisabled: boolean;
  isSubmitting: boolean;
  kitchenNote: string;
  locale: PosLocale;
  menuItems: ReadonlyMap<string, CashierMenuItem>;
  missingMarkingMessage: string;
  selectedItemKey: string | null;
  serviceFee: number | string | undefined;
  serviceFeeLabel: string;
  showMissingMarkings: boolean;
  showServiceFee: boolean;
  showVat: boolean;
  subtotal: number | string | undefined;
  total: number | string | undefined;
  userName: string | undefined;
  vatAmount: number;
  vatLabel: string;
  onAdd: PosCartItemGroupsProps<CashierMenuItem>['onAdd'];
  onChannelChange: (channel: Channel) => void;
  onCheckout: () => void;
  onKitchenNoteChange: (value: string) => void;
  onRemove: (itemId: string) => void;
  onSelect: (key: string) => void;
  onSendOrder: () => void;
};

function CartActions({
  copy,
  isSubmitDisabled,
  isSubmitting,
  isTakeaway,
  onCheckout,
  onSendOrder,
}: Pick<CartProps, 'copy' | 'isSubmitDisabled' | 'isSubmitting' | 'onCheckout' | 'onSendOrder'> & {
  isTakeaway: boolean;
}) {
  return (
    <Stack direction="row" spacing={1.1}>
      {!isTakeaway ? (
        <Button
          variant="contained"
          sx={(theme) => ({
            flex: 1,
            backgroundImage: 'none',
            backgroundColor: 'var(--pos-secondary-action-bg)',
            color: theme.palette.mode === 'dark' ? '#f5f5f5' : theme.palette.text.primary,
          })}
          disabled={isSubmitDisabled}
          onClick={onSendOrder}>
          {isSubmitting ? copy.processing : copy.sendOrder}
        </Button>
      ) : null}
      <Button variant="contained" sx={{ flex: isTakeaway ? 1 : 1.1 }} disabled={isSubmitDisabled} onClick={onCheckout}>
        {copy.goToPayment}
      </Button>
    </Stack>
  );
}

function CartItems({ groups, ...props }: CartProps & { variant: 'desktop' | 'mobile' }) {
  if (groups.length === 0 && props.variant === 'desktop') {
    return (
      <Stack sx={{ height: '100%', justifyContent: 'center', textAlign: 'center' }} spacing={1}>
        <Typography variant="h6">{props.copy.emptyOrder}</Typography>
        <Typography variant="body1" color="text.secondary">
          {props.copy.builderEmpty}
        </Typography>
      </Stack>
    );
  }

  return (
    <PosCartItemGroups
      groups={groups}
      itemQuantityLabel={props.copy.itemQuantityLabel}
      locale={props.locale}
      markingProgressLabel={props.copy.markingProgress}
      menuItems={props.menuItems}
      onAdd={props.onAdd}
      onRemove={props.onRemove}
      onSelect={props.onSelect}
      selectedItemKey={props.selectedItemKey}
      variant={props.variant}
    />
  );
}

function CartFooter(props: CartProps & { compact?: boolean; dense?: boolean }) {
  const condensed = props.compact || props.dense;

  return (
    <Stack spacing={condensed ? 1 : 1.4} sx={props.compact ? undefined : { p: props.dense ? 1.5 : 2.25 }}>
      <TextField
        label={props.copy.kitchenNote}
        value={props.kitchenNote}
        onChange={(event) => props.onKitchenNoteChange(event.target.value)}
        multiline
        minRows={props.compact ? 2 : 1}
        size={props.dense ? 'small' : 'medium'}
      />
      <CashierOrderTotals
        compact={condensed}
        copy={props.copy}
        locale={props.locale}
        subtotal={props.subtotal}
        serviceFee={props.serviceFee}
        serviceFeeLabel={props.serviceFeeLabel}
        showServiceFee={props.showServiceFee}
        vatAmount={props.vatAmount}
        vatLabel={props.vatLabel}
        showVat={props.showVat}
        total={props.total}
      />
      {props.showMissingMarkings ? (
        <Typography variant="body2" color="error.main">
          {props.missingMarkingMessage}
        </Typography>
      ) : null}
      <CartActions
        copy={props.copy}
        isSubmitDisabled={props.isSubmitDisabled}
        isSubmitting={props.isSubmitting}
        isTakeaway={props.channel === 'takeaway'}
        onCheckout={props.onCheckout}
        onSendOrder={props.onSendOrder}
      />
    </Stack>
  );
}

export function CashierBuilderDesktopCart(props: CartProps) {
  const dense = useMediaQuery('(max-height: 820px)');

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
      <Box sx={{ p: dense ? 1.5 : 2.25 }}>
        <Stack spacing={dense ? 1.15 : 1.7}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box
              sx={{
                minWidth: dense ? 52 : 64,
                height: dense ? 52 : 64,
                borderRadius: '10px',
                backgroundColor: 'var(--pos-order-avatar-bg)',
                display: 'grid',
                placeItems: 'center',
                fontSize: 28,
                fontWeight: 700,
              }}>
              TG
            </Box>
            <Stack spacing={0.45}>
              <Typography variant="body1" color="text.secondary">
                {props.copy.orders}: {props.currentOrderLabel}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {props.userName}
              </Typography>
            </Stack>
          </Stack>
          <PosOrderChannelSegment
            takeawayLabel={props.copy.takeaway}
            channel={props.channel}
            disabled={props.channelSwitchDisabled}
            items={[
              { value: 'hall', label: props.copy.hall },
              { value: 'takeaway', label: props.copy.takeawaySwitch },
              { value: 'delivery', label: props.copy.deliverySwitch },
            ]}
            onChange={props.onChannelChange}
          />
        </Stack>
      </Box>
      <Box sx={{ px: 2.25, pb: 2, flex: 1, overflowY: props.groups.length > 0 ? 'auto' : 'hidden' }}>
        <Stack spacing={1.45} sx={props.groups.length === 0 ? { height: '100%' } : undefined}>
          <CartItems {...props} variant="desktop" />
        </Stack>
      </Box>
      <Divider />
      <CartFooter {...props} dense={dense} />
    </Box>
  );
}

export function CashierBuilderMobileCart({
  open,
  onClose,
  ...props
}: CartProps & { open: boolean; onClose: () => void }) {
  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          height: 'min(82dvh, 860px)',
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          backgroundImage: 'none',
          overflow: 'hidden',
        },
      }}>
      <Stack sx={{ height: '100%' }}>
        <Stack direction="row" spacing={1.2} alignItems="center" justifyContent="space-between" sx={{ px: 2, py: 1.5 }}>
          <Stack spacing={0.25}>
            <Typography variant="h6">{props.copy.bills}</Typography>
            <Typography variant="body2" color="text.secondary">
              {props.copy.orders}: {props.currentOrderLabel}
            </Typography>
          </Stack>
          <PosIconAction icon="solar:close-circle-bold-duotone" onClick={onClose} />
        </Stack>
        <Box sx={{ px: 2, pb: 1.35 }}>
          <PosOrderChannelSegment
            takeawayLabel={props.copy.takeaway}
            channel={props.channel}
            compact
            disabled={props.channelSwitchDisabled}
            items={[
              { value: 'takeaway', label: props.copy.takeaway },
              { value: 'delivery', label: props.copy.delivery },
            ]}
            onChange={props.onChannelChange}
          />
        </Box>
        <Divider />
        <Box sx={{ px: 2, py: 1.5, flex: 1, overflowY: 'auto' }}>
          <Stack spacing={1.25}>
            <CartItems {...props} variant="mobile" />
          </Stack>
        </Box>
        <Divider />
        <Stack sx={{ px: 2, py: 1.6 }}>
          <CartFooter {...props} compact />
        </Stack>
      </Stack>
    </Drawer>
  );
}
