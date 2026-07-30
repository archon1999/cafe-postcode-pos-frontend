import { Box, IconButton, Typography, alpha } from '@mui/material';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

import type { KitchenMonitorQueue, KitchenMonitorTicket } from 'modules/kitchen/domain';

const ITEMS_PER_PAGE = 12;
const PAGE_ROTATION_MS = 8000;
const PREPARING_COLOR = '#1d6fd1';
const READY_COLOR = '#168a73';
const TV_CANVAS_WIDTH = 1920;
const TV_CANVAS_HEIGHT = 1080;
const CLOCK_TICK_MS = 30_000;

function formatOrderNumber(ticket: KitchenMonitorTicket) {
  return ticket.displayName?.trim() || String(ticket.orderNumber);
}

function useMonitorClock() {
  const [currentTime, setCurrentTime] = useState(() => new Date());

  useEffect(() => {
    const intervalId = window.setInterval(() => setCurrentTime(new Date()), CLOCK_TICK_MS);
    return () => window.clearInterval(intervalId);
  }, []);

  return currentTime;
}

function useTvViewport() {
  const [viewport, setViewport] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }));

  useEffect(() => {
    const updateViewport = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  return viewport;
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
  headerRight,
}: {
  title: string;
  items: KitchenMonitorTicket[];
  color: string;
  headerRight?: ReactNode;
}) {
  const { pageCount, pageIndex, visibleItems } = usePagedTickets(items);

  return (
    <Box
      sx={{
        minWidth: 0,
        minHeight: 0,
        display: 'grid',
        gridTemplateRows: '104px minmax(0, 1fr)',
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: '#fff',
      }}>
      <Box
        sx={{
          px: 40,
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
            fontSize: 52,
            fontWeight: 780,
            letterSpacing: '-0.025em',
            lineHeight: 1,
          }}>
          {title}
        </Typography>
        {headerRight}
      </Box>

      <Box
        sx={{
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gridTemplateRows: 'repeat(6, minmax(0, 1fr))',
          gridAutoFlow: 'column',
          px: 24,
          py: 20,
          columnGap: 24,
        }}>
        {visibleItems.map((ticket) => (
          <Box
            key={ticket.id}
            data-monitor-ticket-id={ticket.id}
            sx={{
              minWidth: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              px: 16,
            }}>
            <Typography
              sx={{
                width: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                color,
                textAlign: 'center',
                fontSize: 96,
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
            fontSize: 14,
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
  const currentTime = useMonitorClock();
  const viewport = useTvViewport();
  const [isFullscreen, setIsFullscreen] = useState(() => Boolean(document.fullscreenElement));

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen?.();
      else await document.documentElement.requestFullscreen?.();
    } catch {
      // Some TV browsers disable the Fullscreen API; scaling still works without it.
    }
  };

  const canvasScale = Math.min(viewport.width / TV_CANVAS_WIDTH, viewport.height / TV_CANVAS_HEIGHT);
  const formattedTime = new Intl.DateTimeFormat('uz-UZ', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(currentTime);
  const formattedDate = [
    String(currentTime.getDate()).padStart(2, '0'),
    String(currentTime.getMonth() + 1).padStart(2, '0'),
    currentTime.getFullYear(),
  ].join('.');

  return (
    <Box
      data-monitor-variant="light_compact"
      sx={{
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: '#fff',
      }}>
      <Box
        data-testid="monitor-canvas"
        data-layout="scaled"
        data-scale={canvasScale.toFixed(4)}
        sx={{
          width: TV_CANVAS_WIDTH,
          height: TV_CANVAS_HEIGHT,
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: '1px',
          overflow: 'hidden',
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: `translate(-50%, -50%) scale(${canvasScale})`,
          transformOrigin: 'center center',
          backgroundColor: '#d7dce0',
        }}>
        <CompactColumn
          title="Tayyorlanayapti"
          items={monitorData.preparing}
          color={PREPARING_COLOR}
          headerRight={
            restaurantName ? (
              <Typography
                sx={{
                  maxWidth: 360,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontSize: 22,
                  fontWeight: 700,
                  opacity: 0.8,
                }}>
                {restaurantName}
              </Typography>
            ) : null
          }
        />
        <CompactColumn
          title="Tayyor bo'lganlar"
          items={monitorData.recentlyDone}
          color={READY_COLOR}
          headerRight={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.25 }}>
              <Box sx={{ textAlign: 'right' }}>
                <Typography
                  data-testid="monitor-clock"
                  sx={{ fontSize: 30, fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                  {formattedTime}
                </Typography>
                <Typography sx={{ mt: 0.5, fontSize: 14, fontWeight: 650, lineHeight: 1, opacity: 0.72 }}>
                  {formattedDate}
                </Typography>
              </Box>
              <IconButton
                aria-label={isFullscreen ? 'To‘liq ekrandan chiqish' : 'To‘liq ekranga o‘tish'}
                onClick={() => void toggleFullscreen()}
                sx={{
                  width: 62,
                  height: 62,
                  borderRadius: 2.5,
                  color: '#fff',
                  border: '1px solid rgba(255, 255, 255, 0.42)',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.2)' },
                }}>
                <Typography component="span" sx={{ fontSize: 34, lineHeight: 1 }}>
                  {isFullscreen ? '×' : '⛶'}
                </Typography>
              </IconButton>
            </Box>
          }
        />
      </Box>
    </Box>
  );
}
