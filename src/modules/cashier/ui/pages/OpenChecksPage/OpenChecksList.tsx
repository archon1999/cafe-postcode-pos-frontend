import { Icon } from '@iconify/react';
import { Box, Stack, Typography } from '@mui/material';
import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';

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
  const swipeStartRef = useRef<{ orderId: string; pointerId: number; x: number; y: number } | null>(null);
  const suppressClickUntilRef = useRef(0);
  const [swipedOrderId, setSwipedOrderId] = useState<string | null>(null);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>, order: CashierOrder) => {
    if (selectedTab !== 'open') return;
    if (event.isPrimary === false || (event.pointerType === 'mouse' && event.button !== 0)) return;
    if ((event.target as Element).closest('button')) return;

    swipeStartRef.current = {
      orderId: order.id,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setSwipedOrderId(null);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>, order: CashierOrder) => {
    const start = swipeStartRef.current;
    if (!start || start.orderId !== order.id || start.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (Math.abs(deltaY) > Math.abs(deltaX)) return;

    setSwipedOrderId(deltaX < -28 ? order.id : null);
  };

  const handlePointerEnd = (event: PointerEvent<HTMLDivElement>, order: CashierOrder) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    setSwipedOrderId(null);
    if (!start || start.orderId !== order.id || start.pointerId !== event.pointerId || selectedTab !== 'open') {
      return;
    }

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (deltaX < -72 && Math.abs(deltaX) > Math.abs(deltaY) * 1.4) {
      suppressClickUntilRef.current = Date.now() + 500;
      onSwipeEdit(order);
    }
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
            data-swipe-revealed={swipedOrderId === order.id ? 'true' : undefined}
            onPointerDown={(event) => handlePointerDown(event, order)}
            onPointerMove={(event) => handlePointerMove(event, order)}
            onPointerUp={(event) => handlePointerEnd(event, order)}
            onPointerCancel={() => {
              swipeStartRef.current = null;
              setSwipedOrderId(null);
            }}
            onDragStart={(event) => event.preventDefault()}
            onClick={() => {
              if (Date.now() < suppressClickUntilRef.current) return;
              onSelect(order.id);
            }}
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
              userSelect: 'none',
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
