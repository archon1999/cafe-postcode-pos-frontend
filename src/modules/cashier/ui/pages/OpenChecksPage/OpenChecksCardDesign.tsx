import { Icon } from '@iconify/react';
import { Box, IconButton, Stack, Typography, alpha } from '@mui/material';

import { getCashierOrderDisplayName } from 'modules/cashier/domain';
import type { CashierCheckStatus, CashierOrder } from 'modules/cashier/domain/entities/order.types';
import { type PosLocale, getPosCopy } from 'shared/locale/copy';
import { getPosOrderLocationLabel, getPosTableNumberLabel, getPosZoneContextLabel } from 'shared/pos/orderLocation';
import { formatCompactMoney, formatTime } from 'shared/pos/utils';
import { PosLocationHeading } from 'shared/ui/pos-primitives/PosLocationHeading';

function RenameAction({ copy, onRename }: { copy: ReturnType<typeof getPosCopy>; onRename?: () => void }) {
  if (!onRename) return null;

  return (
    <IconButton
      aria-label={copy.renameOrder}
      onClick={(event) => {
        event.stopPropagation();
        onRename();
      }}
      sx={(theme) => ({
        width: 30,
        height: 30,
        color: 'text.secondary',
        '&:hover': {
          color: 'primary.main',
          backgroundColor: alpha(theme.palette.primary.main, 0.1),
        },
      })}>
      <Icon icon="solar:pen-2-bold-duotone" width={17} />
    </IconButton>
  );
}

function MetaPill({ icon, label }: { icon: string; label: string }) {
  return (
    <Stack
      direction="row"
      spacing={0.5}
      alignItems="center"
      sx={(theme) => ({
        minWidth: 0,
        flexShrink: 0,
        borderRadius: '7px',
        px: 0.75,
        py: 0.38,
        color: 'text.secondary',
        backgroundColor: alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.055 : 0.045),
      })}>
      <Icon icon={icon} width={14} />
      <Typography variant="caption" noWrap sx={{ fontWeight: 550, lineHeight: 1.3 }}>
        {label}
      </Typography>
    </Stack>
  );
}

function PriceBlock({
  locale,
  order,
  selectedTab,
}: {
  locale: PosLocale;
  order: CashierOrder;
  selectedTab: CashierCheckStatus;
}) {
  return (
    <Stack spacing={0.25} alignItems="flex-end" sx={{ flexShrink: 0, pl: 1 }}>
      <Typography variant="h6" sx={{ fontWeight: 750, lineHeight: 1.15, whiteSpace: 'nowrap' }}>
        {formatCompactMoney(order.total, locale)}
      </Typography>
      <Stack direction="row" spacing={0.45} alignItems="center" color="text.secondary">
        <Icon icon="solar:clock-circle-linear" width={14} />
        <Typography variant="caption">
          {formatTime(selectedTab === 'closed' ? (order.closedAt ?? order.createdAt) : order.createdAt, locale)}
        </Typography>
      </Stack>
    </Stack>
  );
}

function OrderAvatar({ label, size }: { label: string; size: number }) {
  return (
    <Box
      data-order-avatar={label}
      sx={(theme) => ({
        width: size,
        minWidth: size,
        height: size,
        borderRadius: '12px',
        display: 'grid',
        placeItems: 'center',
        fontSize: size >= 60 ? 26 : 19,
        fontWeight: 800,
        lineHeight: 1,
        color: 'text.primary',
        background: 'var(--pos-check-card-avatar-bg)',
        border: `1px solid ${alpha(theme.palette.common.white, 0.04)}`,
      })}>
      {label}
    </Box>
  );
}

export function OpenCheckOrderSummary({
  context,
  copy,
  locale,
  onRename,
  order,
  selectedTab,
}: {
  context: 'list' | 'detail';
  copy: ReturnType<typeof getPosCopy>;
  locale: PosLocale;
  onRename?: () => void;
  order: CashierOrder;
  selectedTab: CashierCheckStatus;
}) {
  const isList = context === 'list';
  const displayName = getCashierOrderDisplayName(order);
  const location = getPosOrderLocationLabel(order);
  const channel =
    order.channel === 'delivery'
      ? copy.deliveryLabel
      : order.channel === 'takeaway'
        ? copy.takeawayLabel
        : `${order.guestCount} ${copy.guests}`;
  const tableNumber = getPosTableNumberLabel(order);
  if (!isList) {
    const contextLabel =
      order.channel === 'delivery'
        ? copy.deliveryLabel
        : order.channel === 'takeaway'
          ? copy.takeawayLabel
          : tableNumber === '0'
            ? copy.hallLabel
            : `${copy.tableLabel} ${tableNumber}`;
    const title = `${order.displayName?.trim() ? displayName : `#${order.orderNumber}`} · ${contextLabel}`;

    return (
      <Typography
        variant="subtitle1"
        component="h2"
        noWrap
        title={title}
        data-card-design="compact"
        sx={{ px: 2.5, py: 1.5, flexShrink: 0, fontWeight: 700 }}>
        {title}
      </Typography>
    );
  }
  const avatar =
    order.channel === 'delivery' ? 'D' : order.channel === 'takeaway' ? 'S' : tableNumber === '0' ? 'Z' : tableNumber;

  return (
    <Stack
      direction="row"
      spacing={{ xs: 1.2, md: 1.55 }}
      alignItems="center"
      sx={{ p: { xs: 1.55, md: 1.8 } }}
      data-card-design="balanced">
      <OrderAvatar label={avatar} size={60} />
      <Stack spacing={0.5} sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={0.5} alignItems="center">
          <Typography variant="h6" noWrap sx={{ minWidth: 0 }}>
            {displayName}
          </Typography>
          <RenameAction copy={copy} onRename={onRename} />
        </Stack>
        {location ? <PosLocationHeading zone={getPosZoneContextLabel(order)} hall={order.hallName} inline /> : null}
        <Stack direction="row" data-guest-chip-layout="below">
          <MetaPill icon="solar:users-group-rounded-linear" label={channel} />
        </Stack>
      </Stack>
      <PriceBlock locale={locale} order={order} selectedTab={selectedTab} />
    </Stack>
  );
}

export function getOpenChecksCardSx(selected: boolean) {
  return (theme: import('@mui/material/styles').Theme) => ({
    borderRadius: '16px',
    backgroundColor: selected ? 'var(--pos-check-card-selected-bg)' : 'var(--pos-check-card-bg)',
    border: 0,
    boxShadow: 'var(--pos-card-shadow)',
    '&:hover': {
      boxShadow: 'var(--pos-card-hover-shadow)',
      backgroundColor: selected ? 'var(--pos-check-card-selected-bg)' : 'var(--pos-cart-item-hover-bg)',
    },
    '&:active': { backgroundColor: 'var(--pos-check-card-selected-bg)', boxShadow: 'var(--pos-card-shadow)' },
    '&:focus-visible': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: -2 },
  });
}
