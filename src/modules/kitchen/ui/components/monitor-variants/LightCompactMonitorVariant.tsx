import { Box, Typography, alpha } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';

import type { KitchenMonitorQueue, KitchenMonitorTicket } from 'modules/kitchen/domain';

const ITEMS_PER_PAGE = 12;
const PAGE_ROTATION_MS = 8000;
const PREPARING_COLOR = '#1d6fd1';
const READY_COLOR = '#168a73';

function formatOrderNumber(ticket: KitchenMonitorTicket) {
  return ticket.displayName?.trim() || String(ticket.orderNumber);
}

function usePagedTickets(items: KitchenMonitorTicket[]) {
  const pageCount = Math.max(1, Math.ceil(items.length / ITEMS_PER_PAGE));
  const [pageIndex, setPageIndex] = useState(0);

  useEffect(() => {
    setPageIndex((current) => Math.min(current, pageCount - 1));
  }, [pageCount]);

  useEffect(() => {
    if (pageCount <= 1) return undefined;
    const intervalId = window.setInterval(() => setPageIndex((current) => (current + 1) % pageCount), PAGE_ROTATION_MS);
    return () => window.clearInterval(intervalId);
  }, [pageCount]);

  const visibleItems = useMemo(
    () => items.slice(pageIndex * ITEMS_PER_PAGE, (pageIndex + 1) * ITEMS_PER_PAGE),
    [items, pageIndex],
  );

  return { pageCount, pageIndex, visibleItems };
}

function CompactColumn({
  title,
  items,
  color,
  restaurantName,
}: {
  title: string;
  items: KitchenMonitorTicket[];
  color: string;
  restaurantName?: string;
}) {
  const { pageCount, pageIndex, visibleItems } = usePagedTickets(items);

  return (
    <Box
      sx={{
        minWidth: 0,
        minHeight: 0,
        display: 'grid',
        gridTemplateRows: 'clamp(48px, 7vh, 76px) minmax(0, 1fr)',
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: '#fbfaf7',
      }}>
      <Box
        sx={{
          px: 'clamp(14px, 2.1vw, 42px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          color: '#fff',
          backgroundColor: color,
          boxShadow: `0 3px 14px ${alpha(color, 0.22)}`,
        }}>
        <Typography
          component="h2"
          sx={{
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: 'clamp(20px, 2.15vw, 42px)',
            fontWeight: 780,
            letterSpacing: '-0.025em',
            lineHeight: 1,
          }}>
          {title}
        </Typography>
        {restaurantName ? (
          <Typography
            sx={{
              display: { xs: 'none', md: 'block' },
              maxWidth: '42%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontSize: 'clamp(11px, 1vw, 18px)',
              fontWeight: 650,
              opacity: 0.76,
            }}>
            {restaurantName}
          </Typography>
        ) : null}
      </Box>

      <Box
        sx={{
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gridTemplateRows: 'repeat(6, minmax(0, 1fr))',
          gridAutoFlow: 'column',
          px: 'clamp(10px, 1.6vw, 30px)',
          py: 'clamp(8px, 1.3vh, 16px)',
          columnGap: 'clamp(10px, 1.6vw, 28px)',
        }}>
        {visibleItems.map((ticket) => (
          <Box
            key={ticket.id}
            data-monitor-ticket-id={ticket.id}
            sx={{
              minWidth: 0,
              display: 'flex',
              alignItems: 'center',
              px: 'clamp(8px, 1vw, 20px)',
              borderBottom: `1px solid ${alpha(color, 0.14)}`,
            }}>
            <Typography
              sx={{
                width: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                color,
                fontSize: 'clamp(34px, 5.2vw, 96px)',
                fontWeight: 800,
                letterSpacing: '-0.045em',
                lineHeight: 0.95,
                fontVariantNumeric: 'tabular-nums',
              }}>
              {formatOrderNumber(ticket)}
            </Typography>
          </Box>
        ))}
      </Box>

      {pageCount > 1 ? (
        <Typography
          sx={{
            position: 'absolute',
            right: 12,
            bottom: 6,
            color: alpha(color, 0.56),
            fontSize: 'clamp(10px, 0.8vw, 14px)',
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
          }}>
          {pageIndex + 1} / {pageCount}
        </Typography>
      ) : null}
    </Box>
  );
}

export function LightCompactMonitorVariant({
  monitorData,
  restaurantName,
}: {
  monitorData: KitchenMonitorQueue;
  restaurantName?: string;
}) {
  return (
    <Box
      data-testid="monitor-canvas"
      data-monitor-variant="light_compact"
      data-layout="responsive"
      sx={{
        width: '100vw',
        height: '100vh',
        minHeight: 0,
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
        gridTemplateRows: { xs: 'repeat(2, minmax(0, 1fr))', sm: '1fr' },
        gap: '1px',
        overflow: 'hidden',
        backgroundColor: '#cbd1d6',
      }}>
      <CompactColumn
        title="Tayyorlanayapti"
        items={monitorData.preparing}
        color={PREPARING_COLOR}
        restaurantName={restaurantName}
      />
      <CompactColumn title="Tayyor bo'lganlar" items={monitorData.recentlyDone} color={READY_COLOR} />
    </Box>
  );
}
