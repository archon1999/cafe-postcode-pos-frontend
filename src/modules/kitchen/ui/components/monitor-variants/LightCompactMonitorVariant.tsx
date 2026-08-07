import { Box, IconButton, Typography, alpha } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';

import type { KitchenAnnouncement, KitchenMonitorQueue, KitchenMonitorTicket } from 'modules/kitchen/domain';

import { ReadyOrderSpotlight } from './ReadyOrderSpotlight';

const ITEMS_PER_PAGE = 12;
const PAGE_ROTATION_MS = 8000;
const PREPARING_COLOR = '#1d6fd1';
const READY_COLOR = '#168a73';
const TV_CANVAS_WIDTH = 1920;
const TV_CANVAS_HEIGHT = 1080;

function formatOrderNumber(ticket: KitchenMonitorTicket) {
  return ticket.displayName?.trim() || String(ticket.orderNumber);
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
  isFullscreen = false,
  onToggleFullscreen,
  highlightedIds,
}: {
  title: string;
  items: KitchenMonitorTicket[];
  color: string;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  highlightedIds: Set<string>;
}) {
  const { pageCount, pageIndex, visibleItems } = usePagedTickets(items);
  const itemCount = visibleItems.length;
  const columnCount = itemCount <= 1 ? 1 : 2;
  const rowCount = Math.max(1, Math.ceil(itemCount / columnCount));
  const itemLayout = itemCount === 0 ? 'empty' : itemCount === 1 ? 'single' : itemCount === 2 ? 'pair' : 'grid';
  const rowHeight = itemCount <= 2 ? 220 : itemCount <= 4 ? 170 : 110;
  const numberFontSize = itemCount <= 4 ? 190 : 132;

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
          px: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
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
          }}>
          {title}
        </Typography>
        {onToggleFullscreen ? (
          <IconButton
            aria-label={isFullscreen ? 'To‘liq ekrandan chiqish' : 'To‘liq ekranga o‘tish'}
            onClick={onToggleFullscreen}
            sx={{
              width: 62,
              height: 62,
              position: 'absolute',
              right: 24,
              top: '50%',
              transform: 'translateY(-50%)',
              borderRadius: 2.5,
              color: '#fff',
              border: '1px solid rgba(255, 255, 255, 0.42)',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.16)' },
            }}>
            <Typography component="span" sx={{ fontSize: 34, lineHeight: 1 }}>
              {isFullscreen ? '×' : '⛶'}
            </Typography>
          </IconButton>
        ) : null}
      </Box>

      <Box
        data-testid="compact-monitor-grid"
        data-item-layout={itemLayout}
        data-item-count={itemCount}
        data-number-font-size={numberFontSize}
        sx={{
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${rowCount}, minmax(0, ${rowHeight}px))`,
          gridAutoFlow: 'row',
          alignContent: 'center',
          position: 'relative',
          px: '56px',
          py: '44px',
          columnGap: '28px',
          rowGap: '22px',
        }}>
        {visibleItems.map((ticket) => (
          <Box
            key={ticket.id}
            data-monitor-ticket-id={ticket.id}
            data-highlighted={highlightedIds.has(ticket.id) ? 'true' : 'false'}
            sx={{
              minWidth: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              px: '16px',
              borderRadius: 4,
              backgroundColor: highlightedIds.has(ticket.id) ? alpha(color, 0.1) : 'transparent',
              boxShadow: highlightedIds.has(ticket.id) ? `0 0 42px ${alpha(color, 0.22)}` : 'none',
              transition: 'background-color 180ms ease, box-shadow 180ms ease',
            }}>
            <Typography
              sx={{
                width: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                color,
                textAlign: 'center',
                fontSize: numberFontSize,
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
  activeAnnouncement,
  highlightedDoneIds,
}: {
  monitorData: KitchenMonitorQueue;
  activeAnnouncement: KitchenAnnouncement | null;
  highlightedDoneIds: Set<string>;
}) {
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

  const canvasScaleX = viewport.width / TV_CANVAS_WIDTH;
  const canvasScaleY = viewport.height / TV_CANVAS_HEIGHT;

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
        data-scale-x={canvasScaleX.toFixed(4)}
        data-scale-y={canvasScaleY.toFixed(4)}
        sx={{
          width: TV_CANVAS_WIDTH,
          height: TV_CANVAS_HEIGHT,
          overflow: 'hidden',
          position: 'absolute',
          top: 0,
          left: 0,
          transform: `scale(${canvasScaleX}, ${canvasScaleY})`,
          transformOrigin: 'top left',
          backgroundColor: '#fff',
        }}>
        <Box
          sx={{
            width: '100%',
            height: '100%',
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: '1px',
            backgroundColor: '#d7dce0',
          }}>
          <CompactColumn
            title="Tayyorlanayapti"
            items={monitorData.preparing}
            color={PREPARING_COLOR}
            highlightedIds={new Set<string>()}
          />
          <CompactColumn
            title="Tayyor bo'lganlar"
            items={monitorData.recentlyDone}
            color={READY_COLOR}
            isFullscreen={isFullscreen}
            onToggleFullscreen={() => void toggleFullscreen()}
            highlightedIds={highlightedDoneIds}
          />
        </Box>
        {activeAnnouncement ? (
          <ReadyOrderSpotlight announcement={activeAnnouncement} compactLayout={false} dark={false} />
        ) : null}
      </Box>
    </Box>
  );
}
