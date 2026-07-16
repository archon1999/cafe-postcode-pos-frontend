import { Box, Divider, Drawer, Stack, TextField, Typography } from '@mui/material';

import { formatCompactMoney } from 'shared/pos/utils';
import { PosIconAction, PosOrderChannelSegment } from 'shared/ui/pos-primitives';
import { PosCartItemGroups } from 'shared/ui/pos-primitives/PosCartItemGroups';

import { TableSessionActions, type TableSessionDesktopCartProps } from './TableSessionDesktopCart';

export function TableSessionMobileCart({
  open,
  onClose,
  ...props
}: TableSessionDesktopCartProps & { open: boolean; onClose: () => void }) {
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
              {props.copy.orders}: {props.orderLabel}
            </Typography>
          </Stack>
          <PosIconAction icon="solar:close-circle-bold-duotone" onClick={onClose} />
        </Stack>
        <Box sx={{ px: 2, pb: 1.35 }}>
          <PosOrderChannelSegment
            hallLabel={props.copy.hall}
            takeawayLabel={props.copy.takeaway}
            channel={props.channel}
            compact
          />
        </Box>
        <Divider />
        <Box sx={{ px: 2, py: 1.5, flex: 1, overflowY: 'auto' }}>
          <Stack spacing={1.25}>
            <PosCartItemGroups
              groups={props.groups}
              itemQuantityLabel={props.copy.itemQuantityLabel}
              locale={props.locale}
              menuItems={props.menuItems}
              onAdd={props.onAdd}
              onRemove={props.onRemove}
              onSelect={props.onSelect}
              selectedItemKey={props.selectedItemKey}
              variant="mobile"
            />
          </Stack>
        </Box>
        <Divider />
        <Stack spacing={1.25} sx={{ px: 2, py: 1.6 }}>
          <TextField
            label={props.copy.kitchenNote}
            value={props.kitchenNote}
            onChange={(event) => props.onKitchenNoteChange(event.target.value)}
            multiline
            minRows={2}
          />
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="body2" color="text.secondary">
              {props.copy.subtotal}
            </Typography>
            <Typography variant="body2">{formatCompactMoney(props.subtotal, props.locale)}</Typography>
          </Stack>
          {props.showServiceFee ? (
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">
                {props.serviceFeeLabel}
              </Typography>
              <Typography variant="body2">{formatCompactMoney(props.serviceFee, props.locale)}</Typography>
            </Stack>
          ) : null}
          {props.showVat ? (
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">
                {props.vatLabel}
              </Typography>
              <Typography variant="body2">{formatCompactMoney(props.vatAmount, props.locale)}</Typography>
            </Stack>
          ) : null}
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="body2" color="text.secondary">
              {props.copy.grandTotal}
            </Typography>
            <Typography variant="h6">{formatCompactMoney(props.total, props.locale)}</Typography>
          </Stack>
          <Stack direction="row" spacing={1}>
            <TableSessionActions {...props} />
          </Stack>
        </Stack>
      </Stack>
    </Drawer>
  );
}
