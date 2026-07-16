import { Box, Stack, Typography, alpha, keyframes } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useEffect, useRef, useState } from 'react';

import { usePosSession } from 'modules/auth';
import { useKitchenMonitorQuery } from 'modules/kitchen/application';
import type { KitchenMonitorTicket } from 'modules/kitchen/domain';

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

const READY_SPOTLIGHT_DURATION_MS = 2200;
const READY_SPOTLIGHT_LABEL = 'Tayyor';

type BrowserWindow = typeof window & {
  webkitAudioContext?: typeof AudioContext;
};

function formatOrderNumber(ticket: KitchenMonitorTicket) {
  return `#${ticket.displayName?.trim() || ticket.orderNumber}`;
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
}: {
  title: string;
  items: KitchenMonitorTicket[];
  highlightedIds: Set<string>;
  titleColor: string;
  dividerColor: string;
  rowTextColor: string;
  highlightBackgroundColor: string;
  highlightShadow: string;
}) {
  return (
    <Stack spacing={{ xs: 2, md: 3 }} sx={{ minWidth: 0 }}>
      <Typography
        component="h1"
        sx={{
          textAlign: 'center',
          fontSize: { xs: 28, md: 40, lg: 52 },
          fontWeight: 700,
          letterSpacing: '-0.03em',
          color: titleColor,
        }}>
        {title}
      </Typography>

      <Stack spacing={{ xs: 0.6, md: 1 }}>
        {items.map((ticket) => {
          const isHighlighted = highlightedIds.has(ticket.id);

          return (
            <Box
              key={ticket.id}
              data-highlighted={isHighlighted ? 'true' : 'false'}
              sx={{
                py: { xs: 1.4, md: 2.25 },
                px: { xs: 1, md: 1.5 },
                borderBottom: `1px solid ${dividerColor}`,
                backgroundColor: isHighlighted ? highlightBackgroundColor : 'transparent',
                animation: isHighlighted ? `${readyRowEntrance} 1.2s ease-out` : 'none',
                transformOrigin: 'center right',
              }}>
              <Typography
                sx={{
                  fontSize: { xs: 34, md: 52, lg: 64 },
                  lineHeight: 1.04,
                  fontWeight: 700,
                  letterSpacing: '-0.04em',
                  color: rowTextColor,
                  textShadow: isHighlighted ? highlightShadow : 'none',
                }}>
                {formatOrderNumber(ticket)}
              </Typography>
            </Box>
          );
        })}
      </Stack>
    </Stack>
  );
}

export function KitchenMonitorPage() {
  const { restaurantContext } = usePosSession();
  const theme = useTheme();
  const monitorQuery = useKitchenMonitorQuery(restaurantContext?.restaurantId ?? null);
  const [highlightedDoneIds, setHighlightedDoneIds] = useState<string[]>([]);
  const [spotlightTicket, setSpotlightTicket] = useState<KitchenMonitorTicket | null>(null);
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
    const recentlyDone = monitorQuery.data?.recentlyDone ?? [];
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
  }, [monitorQuery.data?.recentlyDone]);

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

  const monitorData = monitorQuery.data ?? { preparing: [], recentlyDone: [] };
  const isDark = theme.palette.mode === 'dark';
  const monitorBackground = isDark
    ? 'radial-gradient(circle at top, rgba(47, 98, 173, 0.12), transparent 30%), linear-gradient(180deg, #1b1e24 0%, #171a20 100%)'
    : 'radial-gradient(circle at top, rgba(52, 123, 221, 0.12), transparent 32%), linear-gradient(180deg, #f6efe3 0%, #ece1d1 100%)';
  const dividerColor = isDark ? alpha('#ffffff', 0.08) : alpha('#2f3944', 0.14);
  const separatorColor = isDark ? alpha('#ffffff', 0.14) : alpha('#2f3944', 0.18);
  const preparingTitleColor = isDark ? '#59a6ff' : '#1d6fd1';
  const readyTitleColor = isDark ? '#1ec1a2' : '#168a73';
  const rowTextColor = isDark ? '#f5f7fb' : '#27313b';
  const highlightBackgroundColor = isDark ? alpha('#4ac5a1', 0.08) : alpha('#2fb18d', 0.12);
  const highlightShadow = isDark ? '0 0 28px rgba(86, 218, 181, 0.18)' : '0 0 24px rgba(47, 177, 141, 0.2)';

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        px: { xs: 2, md: 3.5, lg: 5 },
        py: { xs: 2.5, md: 3.5, lg: 4.5 },
        background: monitorBackground,
        overflow: 'hidden',
        position: 'relative',
      }}>
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
              width: { xs: 260, md: 430, lg: 560 },
              aspectRatio: '1 / 1',
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
              minWidth: { xs: 260, md: 420, lg: 540 },
              px: { xs: 3, md: 5, lg: 6 },
              py: { xs: 2.6, md: 4.2, lg: 5 },
              borderRadius: { xs: '28px', md: '36px' },
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
                fontSize: { xs: 18, md: 24, lg: 28 },
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
                fontSize: { xs: 64, md: 112, lg: 148 },
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
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 1px minmax(0, 1fr)' },
          gap: { xs: 4, lg: 4 },
          minHeight: 'calc(100dvh - 40px)',
          alignItems: 'stretch',
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
        />

        <Box
          sx={{
            display: { xs: 'none', lg: 'block' },
            width: '1px',
            backgroundColor: separatorColor,
            boxShadow: isDark ? '0 0 12px rgba(255,255,255,0.04)' : '0 0 12px rgba(47,57,68,0.06)',
          }}
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
        />
      </Box>
    </Box>
  );
}
