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

type BrowserWindow = typeof window & {
  webkitAudioContext?: typeof AudioContext;
};

function formatOrderNumber(orderNumber: number) {
  return `A${String(orderNumber).padStart(5, '0')}`;
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
                {formatOrderNumber(ticket.orderNumber)}
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
    const doneIds = monitorQuery.data?.recentlyDone.map((ticket) => ticket.id) ?? [];

    if (previousDoneIdsRef.current === null) {
      previousDoneIdsRef.current = doneIds;
      return;
    }

    const previousIds = new Set(previousDoneIdsRef.current);
    const newlyDoneIds = doneIds.filter((id) => !previousIds.has(id));
    previousDoneIdsRef.current = doneIds;

    if (!newlyDoneIds.length) {
      return;
    }

    setHighlightedDoneIds(newlyDoneIds);
    void playReadySoundRef.current();

    if (clearAnimationTimeoutRef.current) {
      window.clearTimeout(clearAnimationTimeoutRef.current);
    }

    clearAnimationTimeoutRef.current = window.setTimeout(() => {
      setHighlightedDoneIds([]);
      clearAnimationTimeoutRef.current = null;
    }, 1400);
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
      }}>
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
