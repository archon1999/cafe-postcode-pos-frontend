import { Box, IconButton, Stack, Typography, alpha, keyframes } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useEffect, useRef, useState } from 'react';

import { usePosSession } from 'modules/auth';
import { useKitchenMonitorQuery } from 'modules/kitchen/application';
import type { KitchenMonitorQueue, KitchenMonitorTicket } from 'modules/kitchen/domain';

const readyRowEntrance = keyframes`
  0% {
    opacity: 0;
    transform: translateX(28px) scale(0.98);
    background-color: rgba(74, 197, 161, 0.26);
    box-shadow: 0 0 0 rgba(74, 197, 161, 0);
  }
  35% {
    opacity: 1;
    transform: translateX(0) scale(1);
    background-color: rgba(74, 197, 161, 0.22);
    box-shadow: 0 0 36px rgba(86, 218, 181, 0.32);
  }
  100% {
    opacity: 1;
    transform: translateX(0) scale(1);
    background-color: rgba(255, 255, 255, 0.02);
    box-shadow: 0 0 0 rgba(86, 218, 181, 0);
  }
`;

const readySpotlightEntrance = keyframes`
  0% {
    opacity: 0;
    transform: translate3d(-14vw, 0, 0) scale(0.72);
    filter: blur(3px);
  }
  18% {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1);
    filter: blur(0);
  }
  42% {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1.08);
    filter: blur(0);
  }
  68% {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1);
    filter: blur(0);
  }
  100% {
    opacity: 0;
    transform: translate3d(30vw, 0, 0) scale(0.72);
    filter: blur(2px);
  }
`;

const readySpotlightGlow = keyframes`
  0%, 100% {
    opacity: 0.38;
    transform: scale(0.82);
  }
  42% {
    opacity: 0.86;
    transform: scale(1.14);
  }
`;

const monitorBackgroundDrift = keyframes`
  0% {
    background-position: 46% 0%;
  }
  50% {
    background-position: 54% 8%;
  }
  100% {
    background-position: 48% 0%;
  }
`;

const READY_SPOTLIGHT_DURATION_MS = 2200;
const READY_SPOTLIGHT_LABEL = 'Tayyor';
const TV_ITEMS_PER_PAGE = 6;
const TV_PAGE_ROTATION_MS = 8000;
const TV_CLOCK_TICK_MS = 30_000;

type BrowserWindow = typeof window & {
  webkitAudioContext?: typeof AudioContext;
};

function formatOrderNumber(ticket: KitchenMonitorTicket) {
  return ticket.displayName?.trim() || String(ticket.orderNumber);
}

function useMonitorClock() {
  const [currentTime, setCurrentTime] = useState(() => new Date());

  useEffect(() => {
    const intervalId = window.setInterval(() => setCurrentTime(new Date()), TV_CLOCK_TICK_MS);
    return () => window.clearInterval(intervalId);
  }, []);

  return currentTime;
}

function useRotatingPage(items: KitchenMonitorTicket[]) {
  const pageCount = Math.max(1, Math.ceil(items.length / TV_ITEMS_PER_PAGE));
  const [pageIndex, setPageIndex] = useState(0);

  useEffect(() => {
    setPageIndex((currentPage) => Math.min(currentPage, pageCount - 1));
  }, [pageCount]);

  useEffect(() => {
    if (pageCount <= 1) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setPageIndex((currentPage) => (currentPage + 1) % pageCount);
    }, TV_PAGE_ROTATION_MS);
    return () => window.clearInterval(intervalId);
  }, [pageCount]);

  const pageStart = pageIndex * TV_ITEMS_PER_PAGE;
  return {
    pageCount,
    pageIndex,
    visibleItems: items.slice(pageStart, pageStart + TV_ITEMS_PER_PAGE),
  };
}

function MonitorColumn({
  title,
  items,
  highlightedIds,
  titleColor,
  dividerColor,
  rowTextColor,
  highlightBackgroundColor,
  highlightShadow,
  columnBackground,
  rowBackgroundColor,
  rowAccentColor,
  emptyVariant,
}: {
  title: string;
  items: KitchenMonitorTicket[];
  highlightedIds: Set<string>;
  titleColor: string;
  dividerColor: string;
  rowTextColor: string;
  highlightBackgroundColor: string;
  highlightShadow: string;
  columnBackground: string;
  rowBackgroundColor: string;
  rowAccentColor: string;
  emptyVariant: 'preparing' | 'ready';
}) {
  const { pageCount, pageIndex, visibleItems } = useRotatingPage(items);
  const fillsPage = visibleItems.length === TV_ITEMS_PER_PAGE;

  return (
    <Stack
      sx={{
        minWidth: 0,
        minHeight: 0,
        height: '100%',
        overflow: 'hidden',
        borderRadius: { xs: 2.75, md: 4.5 },
        border: `1px solid ${dividerColor}`,
        background: columnBackground,
        boxShadow: '0 22px 54px rgba(0, 0, 0, 0.1)',
        px: { xs: 2, md: 3.75 },
        pt: { xs: 2.25, md: 3.75 },
        pb: { xs: 1.75, md: 3 },
      }}>
      <Typography
        component="h2"
        sx={{
          textAlign: 'center',
          fontSize: { xs: 27, md: 40, xl: 54 },
          fontWeight: 820,
          letterSpacing: '-0.03em',
          lineHeight: 1,
          color: titleColor,
          mb: { xs: 1.75, md: 3.5 },
          textShadow: `0 0 26px ${alpha(titleColor, 0.14)}`,
          '&::after': {
            content: '""',
            display: 'block',
            width: { xs: 44, md: 72 },
            height: { xs: 3, md: 5 },
            mx: 'auto',
            mt: { xs: 1.125, md: 1.75 },
            borderRadius: 999,
            backgroundColor: alpha(titleColor, 0.62),
            boxShadow: `0 0 18px ${alpha(titleColor, 0.2)}`,
          },
        }}>
        {title}
      </Typography>

      <Stack spacing={1} sx={{ flex: 1, minHeight: 0 }}>
        {visibleItems.map((ticket) => {
          const isHighlighted = highlightedIds.has(ticket.id);

          return (
            <Box
              key={ticket.id}
              data-highlighted={isHighlighted ? 'true' : 'false'}
              sx={{
                flex: fillsPage ? '1 1 0' : '0 0 auto',
                minHeight: { xs: 68, md: 84, xl: 104 },
                px: { xs: 2.5, md: 5 },
                py: { xs: 0.75, md: 1.25 },
                display: 'flex',
                alignItems: 'center',
                position: 'relative',
                overflow: 'hidden',
                borderRadius: { xs: 1.75, md: 3 },
                border: `1px solid ${alpha(rowAccentColor, 0.15)}`,
                backgroundColor: isHighlighted ? highlightBackgroundColor : rowBackgroundColor,
                animation: isHighlighted ? `${readyRowEntrance} 1.2s ease-out` : 'none',
                transformOrigin: 'center right',
                boxShadow: isHighlighted ? highlightShadow : '0 8px 22px rgba(0, 0, 0, 0.055)',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  inset: '18% auto 18% 0',
                  width: { xs: 3, md: 5 },
                  borderRadius: '0 999px 999px 0',
                  backgroundColor: alpha(rowAccentColor, 0.72),
                  boxShadow: `0 0 16px ${alpha(rowAccentColor, 0.24)}`,
                },
              }}>
              <Typography
                sx={{
                  fontSize: { xs: 40, md: 60, xl: 82 },
                  lineHeight: 1,
                  fontWeight: 820,
                  letterSpacing: '-0.04em',
                  color: rowTextColor,
                  textShadow: isHighlighted ? highlightShadow : 'none',
                  fontVariantNumeric: 'tabular-nums',
                }}>
                {formatOrderNumber(ticket)}
              </Typography>
            </Box>
          );
        })}

        {!items.length ? (
          <Box
            aria-hidden="true"
            data-testid="monitor-empty-visual"
            sx={{ flex: 1, minHeight: 160, display: 'grid', placeItems: 'center' }}>
            <Box
              sx={{
                width: { xs: 92, md: 128, xl: 164 },
                height: { xs: 92, md: 128, xl: 164 },
                display: 'grid',
                placeItems: 'center',
                position: 'relative',
                borderRadius: '50%',
                border: `3px solid ${alpha(titleColor, 0.1)}`,
                background: `radial-gradient(circle, ${alpha(titleColor, 0.045)}, transparent 68%)`,
                boxShadow: `0 0 70px ${alpha(titleColor, 0.055)}`,
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  inset: '14%',
                  borderRadius: '50%',
                  border: `1px solid ${alpha(titleColor, 0.07)}`,
                },
              }}>
              {emptyVariant === 'ready' ? (
                <Box
                  sx={{
                    width: '25%',
                    height: '42%',
                    borderRight: `6px solid ${alpha(titleColor, 0.18)}`,
                    borderBottom: `6px solid ${alpha(titleColor, 0.18)}`,
                    transform: 'translateY(-8%) rotate(45deg)',
                    borderRadius: '0 0 4px 0',
                  }}
                />
              ) : (
                <Stack direction="row" spacing={1}>
                  {[0, 1, 2].map((dot) => (
                    <Box
                      key={dot}
                      sx={{
                        width: { xs: 9, md: 14 },
                        height: { xs: 9, md: 14 },
                        borderRadius: '50%',
                        backgroundColor: alpha(titleColor, 0.16 + dot * 0.025),
                      }}
                    />
                  ))}
                </Stack>
              )}
            </Box>
          </Box>
        ) : null}
      </Stack>

      {pageCount > 1 ? (
        <Typography
          data-testid="monitor-page-indicator"
          sx={{
            alignSelf: 'center',
            mt: { xs: 1.25, md: 2 },
            px: { xs: 1.25, md: 2 },
            py: { xs: 0.375, md: 0.75 },
            textAlign: 'center',
            color: alpha(rowTextColor, 0.64),
            fontSize: { xs: 13, md: 18 },
            fontWeight: 750,
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1,
            borderRadius: 999,
            border: `1px solid ${alpha(rowAccentColor, 0.12)}`,
            backgroundColor: alpha(rowAccentColor, 0.055),
          }}>
          {pageIndex + 1} / {pageCount}
        </Typography>
      ) : null}
    </Stack>
  );
}

export function KitchenMonitorDisplay({
  monitorData,
  restaurantName,
}: {
  monitorData: KitchenMonitorQueue;
  restaurantName?: string;
}) {
  const theme = useTheme();
  const currentTime = useMonitorClock();
  const [highlightedDoneIds, setHighlightedDoneIds] = useState<string[]>([]);
  const [spotlightTicket, setSpotlightTicket] = useState<KitchenMonitorTicket | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(() => Boolean(document.fullscreenElement));
  const previousDoneIdsRef = useRef<string[] | null>(null);
  const clearAnimationTimeoutRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const playReadySoundRef = useRef<() => Promise<void>>(async () => undefined);

  playReadySoundRef.current = async () => {
    const browserWindow = window as BrowserWindow;
    const AudioContextConstructor = window.AudioContext ?? browserWindow.webkitAudioContext;

    if (!AudioContextConstructor) {
      return;
    }

    try {
      const audioContext = audioContextRef.current ?? new AudioContextConstructor();
      audioContextRef.current = audioContext;

      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      const startAt = audioContext.currentTime;

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(932, startAt);
      oscillator.frequency.exponentialRampToValueAtTime(784, startAt + 0.18);

      gainNode.gain.setValueAtTime(0.0001, startAt);
      gainNode.gain.exponentialRampToValueAtTime(0.08, startAt + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.24);

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.start(startAt);
      oscillator.stop(startAt + 0.26);
    } catch {
      // Ignore autoplay and output device errors on passive monitor screens.
    }
  };

  useEffect(() => {
    const recentlyDone = monitorData.recentlyDone;
    const doneIds = recentlyDone.map((ticket) => ticket.id);

    if (previousDoneIdsRef.current === null) {
      previousDoneIdsRef.current = doneIds;
      return;
    }

    const previousIds = new Set(previousDoneIdsRef.current);
    const newlyDoneTickets = recentlyDone.filter((ticket) => !previousIds.has(ticket.id));
    const newlyDoneIds = newlyDoneTickets.map((ticket) => ticket.id);
    previousDoneIdsRef.current = doneIds;

    if (!newlyDoneIds.length) {
      return;
    }

    setHighlightedDoneIds(newlyDoneIds);
    setSpotlightTicket(newlyDoneTickets[0]);
    void playReadySoundRef.current();

    if (clearAnimationTimeoutRef.current) {
      window.clearTimeout(clearAnimationTimeoutRef.current);
    }

    clearAnimationTimeoutRef.current = window.setTimeout(() => {
      setHighlightedDoneIds([]);
      setSpotlightTicket(null);
      clearAnimationTimeoutRef.current = null;
    }, READY_SPOTLIGHT_DURATION_MS);
  }, [monitorData.recentlyDone]);

  useEffect(() => {
    return () => {
      if (clearAnimationTimeoutRef.current) {
        window.clearTimeout(clearAnimationTimeoutRef.current);
      }

      if (audioContextRef.current) {
        void audioContextRef.current.close().catch(() => undefined);
      }
    };
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen?.();
      } else {
        await document.documentElement.requestFullscreen?.();
      }
    } catch {
      // Some TV browsers disable the Fullscreen API; the layout still remains TV-safe.
    }
  };

  const isDark = theme.palette.mode === 'dark';
  const monitorBackground = isDark
    ? 'radial-gradient(circle at top, rgba(47, 98, 173, 0.12), transparent 30%), linear-gradient(180deg, #1b1e24 0%, #171a20 100%)'
    : 'radial-gradient(circle at top, rgba(52, 123, 221, 0.12), transparent 32%), linear-gradient(180deg, #f6efe3 0%, #ece1d1 100%)';
  const dividerColor = isDark ? alpha('#ffffff', 0.08) : alpha('#2f3944', 0.14);
  const preparingTitleColor = isDark ? '#59a6ff' : '#1d6fd1';
  const readyTitleColor = isDark ? '#1ec1a2' : '#168a73';
  const rowTextColor = isDark ? '#f5f7fb' : '#27313b';
  const highlightBackgroundColor = isDark ? alpha('#4ac5a1', 0.08) : alpha('#2fb18d', 0.12);
  const highlightShadow = isDark ? '0 0 28px rgba(86, 218, 181, 0.18)' : '0 0 24px rgba(47, 177, 141, 0.2)';
  const preparingColumnBackground = isDark
    ? 'linear-gradient(155deg, rgba(31, 96, 176, 0.16), rgba(17, 22, 31, 0.7) 58%)'
    : 'linear-gradient(155deg, rgba(44, 122, 218, 0.12), rgba(255, 252, 246, 0.76) 58%)';
  const readyColumnBackground = isDark
    ? 'linear-gradient(155deg, rgba(24, 154, 126, 0.17), rgba(17, 22, 31, 0.7) 58%)'
    : 'linear-gradient(155deg, rgba(23, 151, 121, 0.12), rgba(255, 252, 246, 0.76) 58%)';
  const preparingRowBackground = isDark ? alpha('#3388e8', 0.065) : alpha('#2f7fd9', 0.07);
  const readyRowBackground = isDark ? alpha('#2fc69e', 0.065) : alpha('#229979', 0.075);
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
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        px: { xs: 2.5, md: 5, xl: 8 },
        py: { xs: 1.75, md: 3, xl: 4.5 },
        background: monitorBackground,
        backgroundSize: '140% 140%',
        animation: `${monitorBackgroundDrift} 52s ease-in-out infinite alternate`,
        overflowY: 'auto',
        position: 'relative',
        '@media (orientation: landscape) and (min-width: 700px)': {
          height: '100vh',
          overflow: 'hidden',
        },
      }}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{
          flex: '0 0 auto',
          minHeight: { xs: 36, md: 50, xl: 62 },
          mb: { xs: 1, md: 2 },
          px: { xs: 0.5, md: 1.5 },
        }}>
        {restaurantName ? (
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ minWidth: 0 }}>
            <Box
              aria-hidden="true"
              sx={{
                flex: '0 0 auto',
                width: { xs: 5, md: 9 },
                height: { xs: 30, md: 52 },
                borderRadius: 999,
                background: `linear-gradient(180deg, ${preparingTitleColor}, ${readyTitleColor})`,
                boxShadow: `0 0 22px ${alpha(preparingTitleColor, 0.3)}`,
              }}
            />
            <Typography
              data-testid="monitor-restaurant-name"
              sx={{
                minWidth: 0,
                maxWidth: '55vw',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                color: rowTextColor,
                fontSize: { xs: 22, md: 32, xl: 44 },
                fontWeight: 850,
                lineHeight: 1,
                letterSpacing: '-0.025em',
                textShadow: isDark ? '0 4px 24px rgba(0, 0, 0, 0.28)' : '0 4px 20px rgba(69, 47, 20, 0.12)',
              }}>
              {restaurantName}
            </Typography>
          </Stack>
        ) : null}

        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Box sx={{ textAlign: 'right' }}>
            <Typography
              data-testid="monitor-clock"
              sx={{
                color: rowTextColor,
                fontSize: { xs: 20, md: 29, xl: 38 },
                fontWeight: 800,
                lineHeight: 1,
                fontVariantNumeric: 'tabular-nums',
              }}>
              {formattedTime}
            </Typography>
            <Typography
              sx={{
                color: alpha(rowTextColor, 0.46),
                fontSize: { xs: 10, md: 13, xl: 16 },
                fontWeight: 650,
                lineHeight: 1.1,
                mt: 0.35,
              }}>
              {formattedDate}
            </Typography>
          </Box>

          <IconButton
            aria-label={isFullscreen ? 'To‘liq ekrandan chiqish' : 'To‘liq ekranga o‘tish'}
            onClick={() => void toggleFullscreen()}
            sx={{
              width: { xs: 38, md: 50, xl: 62 },
              height: { xs: 38, md: 50, xl: 62 },
              borderRadius: { xs: 1.5, md: 2.5 },
              color: rowTextColor,
              border: `1px solid ${dividerColor}`,
              backgroundColor: isDark ? alpha('#ffffff', 0.035) : alpha('#ffffff', 0.42),
              '&:hover': {
                backgroundColor: isDark ? alpha('#ffffff', 0.08) : alpha('#ffffff', 0.72),
              },
            }}>
            <Typography component="span" sx={{ fontSize: { xs: 22, md: 28, xl: 34 }, lineHeight: 1 }}>
              {isFullscreen ? '×' : '⛶'}
            </Typography>
          </IconButton>
        </Stack>
      </Stack>

      {spotlightTicket ? (
        <Box
          aria-live="polite"
          data-testid="ready-order-spotlight"
          sx={{
            position: 'absolute',
            inset: 0,
            zIndex: 3,
            pointerEvents: 'none',
            display: 'grid',
            placeItems: 'center',
          }}>
          <Box
            sx={{
              position: 'absolute',
              width: '42vw',
              height: '42vw',
              minWidth: 260,
              minHeight: 260,
              maxWidth: 620,
              maxHeight: 620,
              borderRadius: '50%',
              background: isDark
                ? 'radial-gradient(circle, rgba(77, 235, 194, 0.34), rgba(77, 235, 194, 0.08) 48%, transparent 72%)'
                : 'radial-gradient(circle, rgba(22, 138, 115, 0.28), rgba(22, 138, 115, 0.08) 50%, transparent 74%)',
              animation: `${readySpotlightGlow} ${READY_SPOTLIGHT_DURATION_MS}ms ease-out forwards`,
            }}
          />

          <Box
            sx={{
              position: 'relative',
              width: '40vw',
              minWidth: 260,
              maxWidth: 680,
              px: { xs: 3.5, md: 6, xl: 9 },
              py: { xs: 3, md: 4.5, xl: 6.75 },
              borderRadius: { xs: 3.25, md: 5.25 },
              textAlign: 'center',
              backgroundColor: isDark ? alpha('#111820', 0.92) : alpha('#fffaf1', 0.94),
              border: `1px solid ${isDark ? alpha('#7df5d7', 0.36) : alpha('#168a73', 0.28)}`,
              boxShadow: isDark
                ? '0 0 86px rgba(77, 235, 194, 0.34), 0 26px 90px rgba(0, 0, 0, 0.42)'
                : '0 0 72px rgba(47, 177, 141, 0.24), 0 26px 90px rgba(69, 47, 20, 0.2)',
              animation: `${readySpotlightEntrance} ${READY_SPOTLIGHT_DURATION_MS}ms cubic-bezier(0.16, 1, 0.3, 1) forwards`,
            }}>
            <Typography
              sx={{
                color: readyTitleColor,
                fontSize: { xs: 18, md: 24, xl: 30 },
                fontWeight: 800,
                lineHeight: 1,
                mb: { xs: 1.1, md: 1.6 },
                textTransform: 'uppercase',
              }}>
              {READY_SPOTLIGHT_LABEL}
            </Typography>
            <Typography
              sx={{
                color: rowTextColor,
                fontSize: { xs: 72, md: 120, xl: 168 },
                fontWeight: 800,
                letterSpacing: '-0.04em',
                lineHeight: 0.9,
                textShadow: isDark ? '0 0 34px rgba(125, 245, 215, 0.28)' : '0 0 26px rgba(47, 177, 141, 0.24)',
              }}>
              {formatOrderNumber(spotlightTicket)}
            </Typography>
          </Box>
        </Box>
      ) : null}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: { xs: 1.5, md: 3, xl: 4.25 },
          flex: 1,
          minHeight: 0,
          alignItems: 'stretch',
          '@media (orientation: landscape) and (min-width: 700px)': {
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          },
        }}>
        <MonitorColumn
          title="Tayyorlanayapti"
          items={monitorData.preparing}
          highlightedIds={new Set<string>()}
          titleColor={preparingTitleColor}
          dividerColor={dividerColor}
          rowTextColor={rowTextColor}
          highlightBackgroundColor={highlightBackgroundColor}
          highlightShadow={highlightShadow}
          columnBackground={preparingColumnBackground}
          rowBackgroundColor={preparingRowBackground}
          rowAccentColor={preparingTitleColor}
          emptyVariant="preparing"
        />

        <MonitorColumn
          title="Tayyor bo'lganlar"
          items={monitorData.recentlyDone}
          highlightedIds={new Set(highlightedDoneIds)}
          titleColor={readyTitleColor}
          dividerColor={dividerColor}
          rowTextColor={rowTextColor}
          highlightBackgroundColor={highlightBackgroundColor}
          highlightShadow={highlightShadow}
          columnBackground={readyColumnBackground}
          rowBackgroundColor={readyRowBackground}
          rowAccentColor={readyTitleColor}
          emptyVariant="ready"
        />
      </Box>
    </Box>
  );
}

export function KitchenMonitorPage() {
  const { restaurantContext } = usePosSession();
  const monitorQuery = useKitchenMonitorQuery(restaurantContext?.restaurantId ?? null);

  return (
    <KitchenMonitorDisplay
      monitorData={monitorQuery.data ?? { preparing: [], recentlyDone: [] }}
      restaurantName={restaurantContext?.restaurantName}
    />
  );
}
