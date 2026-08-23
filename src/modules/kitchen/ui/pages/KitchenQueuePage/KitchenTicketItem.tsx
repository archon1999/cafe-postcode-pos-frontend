import { Icon } from '@iconify/react';
import { alpha, Box, Button, Stack, Typography } from '@mui/material';

import type { KitchenItem, KitchenItemStatus } from 'modules/kitchen/domain';
import { type PosLocale, type getPosCopy } from 'shared/locale/copy';
import { formatPosItemQuantityLabel } from 'shared/pos/utils';

import type { KitchenQueueTab } from './KitchenQueueHeader';

export const kitchenStatusMeta = {
  new: { icon: 'solar:clock-circle-bold', color: '#f0b63b', labelColor: '#e0ab39' },
  cooking: { icon: 'solar:fire-square-bold', color: '#f0b63b', labelColor: '#e0ab39' },
  done: { icon: 'solar:check-circle-bold-duotone', color: '#2bc8c2', labelColor: '#2bc8c2' },
  cancelled: { icon: 'solar:close-circle-bold', color: '#d9636b', labelColor: '#d9636b' },
} as const;

type KitchenTicketItemProps = {
  canCancel: boolean;
  canUpdate: boolean;
  copy: ReturnType<typeof getPosCopy>;
  isSelected: boolean;
  item: KitchenItem;
  locale: PosLocale;
  onSelect: (itemId: string) => void;
  onUpdateStatus: (itemId: string, status: KitchenItemStatus) => void;
  selectedTab: KitchenQueueTab;
};

export function KitchenTicketItem({
  canCancel,
  canUpdate,
  copy,
  isSelected,
  item,
  locale,
  onSelect,
  onUpdateStatus,
  selectedTab,
}: KitchenTicketItemProps) {
  const meta = kitchenStatusMeta[item.status];
  const canStart = item.status === 'new';
  const canReady = item.status !== 'done' && item.status !== 'cancelled';
  const canCancelItem = item.status !== 'cancelled' && item.status !== 'done' && canCancel;

  const actionButtonSx = {
    flex: 1,
    minHeight: 42,
    backgroundImage: 'none',
    borderRadius: '14px',
    fontSize: 13.5,
    fontWeight: 700,
  } as const;

  return (
    <Box
      sx={(theme) => ({
        borderRadius: '16px',
        px: 1.3,
        py: 1.2,
        backgroundColor: isSelected
          ? alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.16 : 0.1)
          : 'var(--pos-cart-item-bg)',
        border: `1px solid ${isSelected ? alpha(theme.palette.primary.main, 0.65) : theme.palette.divider}`,
        boxShadow: isSelected ? `0 10px 26px ${alpha(theme.palette.primary.main, 0.16)}` : 'none',
        transition: 'background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease',
        '&:hover': {
          backgroundColor: isSelected
            ? alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.2 : 0.14)
            : 'var(--pos-cart-item-hover-bg)',
        },
      })}>
      <Stack spacing={1}>
        <Stack
          direction="row"
          justifyContent="space-between"
          spacing={1.2}
          alignItems="flex-start"
          onClick={(event) => {
            event.stopPropagation();
            if (selectedTab === 'active') {
              onSelect(item.id);
            }
          }}
          sx={{ cursor: selectedTab === 'active' ? 'pointer' : 'default' }}>
          <Stack spacing={0.35} sx={{ pr: 1 }}>
            <Typography sx={{ fontSize: 14.5, fontWeight: 700, lineHeight: 1.2 }}>
              {formatPosItemQuantityLabel(item.catalogItemName, item.quantity, item.saleUnit, locale)}
            </Typography>
            {item.note ? (
              <Stack
                direction="row"
                spacing={0.6}
                alignItems="flex-start"
                sx={{
                  width: 'fit-content',
                  maxWidth: '100%',
                  px: 0.7,
                  py: 0.45,
                  borderRadius: '7px',
                  bgcolor: alpha('#f0b63b', 0.14),
                  color: '#f0b63b',
                }}>
                <Icon icon="solar:notes-bold-duotone" width={15} />
                <Typography sx={{ color: 'inherit', fontSize: 12.5, fontWeight: 700, lineHeight: 1.25 }}>
                  {item.note}
                </Typography>
              </Stack>
            ) : null}
          </Stack>

          <Box
            sx={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
              backgroundColor: alpha(meta.color, 0.14),
              flexShrink: 0,
            }}>
            <Icon icon={meta.icon} width={16} color={meta.color} />
          </Box>
        </Stack>

        {selectedTab === 'active' && isSelected && canUpdate ? (
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.9}>
            {canStart ? (
              <Button
                variant="contained"
                size="small"
                sx={(theme) => ({
                  ...actionButtonSx,
                  backgroundColor: theme.palette.mode === 'dark' ? '#8c5a4a' : '#c97a63',
                })}
                onClick={(event) => {
                  event.stopPropagation();
                  onUpdateStatus(item.id, 'cooking');
                }}>
                {copy.startCooking}
              </Button>
            ) : null}

            {canReady ? (
              <Button
                variant="contained"
                size="small"
                sx={(theme) => ({
                  ...actionButtonSx,
                  backgroundColor: theme.palette.mode === 'dark' ? '#2f8a84' : '#31a59d',
                })}
                onClick={(event) => {
                  event.stopPropagation();
                  onUpdateStatus(item.id, 'done');
                }}>
                {copy.markReady}
              </Button>
            ) : null}

            {canCancelItem ? (
              <Button
                variant="contained"
                size="small"
                sx={(theme) => ({
                  ...actionButtonSx,
                  backgroundColor: theme.palette.mode === 'dark' ? '#8b4a53' : '#c8646d',
                })}
                onClick={(event) => {
                  event.stopPropagation();
                  onUpdateStatus(item.id, 'cancelled');
                }}>
                {copy.cancelItem}
              </Button>
            ) : null}
          </Stack>
        ) : null}
      </Stack>
    </Box>
  );
}
