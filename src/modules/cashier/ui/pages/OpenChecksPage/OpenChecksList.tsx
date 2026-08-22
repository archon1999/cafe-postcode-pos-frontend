import { Icon } from '@iconify/react';
import { Box, Stack, Typography } from '@mui/material';
import { useRef, useState, type KeyboardEvent, type TouchEvent } from 'react';

import type { CashierCheckStatus, CashierOrder } from 'modules/cashier/domain/entities/order.types';
import { type PosLocale, getPosCopy } from 'shared/locale/copy';

import { OpenCheckOrderSummary, getOpenChecksCardSx } from './OpenChecksCardDesign';

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
              width: '100%',
              textAlign: 'left',
              position: 'relative',
              cursor: 'pointer',
              color: 'inherit',
              outline: 0,
              overflow: 'visible',
              ...getOpenChecksCardSx(selectedOrderId === order.id)(theme),
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
            <OpenCheckOrderSummary
              context="list"
              copy={copy}
              locale={locale}
              onRename={selectedTab === 'open' ? () => onRename(order) : undefined}
              order={order}
              selectedTab={selectedTab}
            />
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
