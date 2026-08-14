import { Icon } from '@iconify/react';
import { Box, IconButton, Stack, Typography } from '@mui/material';
import { useRef, useState, type KeyboardEvent, type TouchEvent } from 'react';

import { getCashierOrderDisplayName, getCashierOrderNumberLabel } from 'modules/cashier/domain';
import type { CashierCheckStatus, CashierOrder } from 'modules/cashier/domain/entities/order.types';
import { type PosLocale, getPosCopy } from 'shared/locale/copy';
import { getPosTableNumberLabel, getPosZoneContextLabel } from 'shared/pos/orderLocation';
import { formatCompactMoney, formatTime } from 'shared/pos/utils';

export function OpenChecksList({
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
                selectedOrderId === order.id ? 'var(--pos-check-card-selected-bg)' : 'var(--pos-check-card-bg)',
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
                  sx={{
                    minWidth: 56,
                    height: 56,
                    borderRadius: '9px',
                    backgroundColor: 'var(--pos-check-card-avatar-bg)',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 22,
                    fontWeight: 700,
                    lineHeight: 1,
                  }}>
                  {order.channel === 'delivery'
                    ? 'YD'
                    : order.channel === 'takeaway'
                      ? 'TG'
                      : getPosTableNumberLabel(order)}
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
          sx={{
            flex: 1,
            borderRadius: '14px',
            minHeight: 420,
            display: 'grid',
            placeItems: 'center',
            backgroundColor: 'var(--pos-check-card-empty-bg)',
          }}>
          <Typography variant="h6" color="text.secondary">
            {selectedTab === 'open'
              ? copy.noChecks
              : selectedTab === 'closed'
                ? copy.noClosedChecks
                : `${copy.fiscalChecks} yo'q`}
          </Typography>
        </Box>
      )}
    </Stack>
  );
}
