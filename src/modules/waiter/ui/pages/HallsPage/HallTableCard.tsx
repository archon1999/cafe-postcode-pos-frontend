import { Box, Stack, Typography, alpha } from '@mui/material';
import { useTheme } from '@mui/material/styles';

import {
  type DiningTable,
  getTableCoreShape,
  getTableMeta,
  getTableVisualState,
  getVariantMarkers,
  shouldShowAttentionDot,
  type TableVisualState,
} from 'modules/waiter/domain';
import { getPosCopy } from 'shared/locale/copy';
import { formatElapsedMinutes } from 'shared/pos/utils';

const tablePalette: Record<
  'dark' | 'light',
  Record<
    TableVisualState,
    {
      rail: string;
      shell: string;
      fill: string;
      numberGlow: string;
      outer: string;
      ink: string;
      meta: string;
      attentionRing: string;
    }
  >
> = {
  dark: {
    available: {
      rail: '#2a2d31',
      shell: '#2e2f33',
      fill: '#666a70',
      numberGlow: 'rgba(0, 0, 0, 0.26)',
      outer: '#232529',
      ink: '#ffffff',
      meta: 'rgba(255, 255, 255, 0.96)',
      attentionRing: 'rgba(34, 36, 40, 0.5)',
    },
    reserved: {
      rail: '#b88a29',
      shell: '#866824',
      fill: '#ffc23c',
      numberGlow: 'rgba(95, 67, 10, 0.28)',
      outer: '#453719',
      ink: '#ffffff',
      meta: 'rgba(255, 255, 255, 0.96)',
      attentionRing: 'rgba(34, 36, 40, 0.5)',
    },
    occupied: {
      rail: '#1f8e89',
      shell: '#285f5d',
      fill: '#31c8c0',
      numberGlow: 'rgba(12, 82, 79, 0.26)',
      outer: '#244f4e',
      ink: '#ffffff',
      meta: 'rgba(255, 255, 255, 0.96)',
      attentionRing: 'rgba(34, 36, 40, 0.5)',
    },
    attention: {
      rail: '#219a95',
      shell: '#285f5d',
      fill: '#31c8c0',
      numberGlow: 'rgba(12, 82, 79, 0.26)',
      outer: '#245150',
      ink: '#ffffff',
      meta: 'rgba(255, 255, 255, 0.96)',
      attentionRing: 'rgba(34, 36, 40, 0.5)',
    },
    cooking: {
      rail: '#2558b3',
      shell: '#224988',
      fill: '#2a78ff',
      numberGlow: 'rgba(17, 45, 93, 0.3)',
      outer: '#203d68',
      ink: '#ffffff',
      meta: 'rgba(255, 255, 255, 0.96)',
      attentionRing: 'rgba(34, 36, 40, 0.5)',
    },
    pending_payment: {
      rail: '#a74448',
      shell: '#8a3b3f',
      fill: '#ff4f59',
      numberGlow: 'rgba(112, 30, 37, 0.28)',
      outer: '#5f2b2f',
      ink: '#ffffff',
      meta: 'rgba(255, 255, 255, 0.96)',
      attentionRing: 'rgba(34, 36, 40, 0.5)',
    },
    blocked: {
      rail: '#7d4a4d',
      shell: '#633a3d',
      fill: '#bf6168',
      numberGlow: 'rgba(73, 30, 34, 0.28)',
      outer: '#48282b',
      ink: '#ffffff',
      meta: 'rgba(255, 255, 255, 0.96)',
      attentionRing: 'rgba(34, 36, 40, 0.5)',
    },
  },
  light: {
    available: {
      rail: '#9aa2ad',
      shell: '#f4f6f9',
      fill: '#7a818b',
      numberGlow: 'rgba(63, 72, 83, 0.16)',
      outer: '#d8dde5',
      ink: '#ffffff',
      meta: '#5f6875',
      attentionRing: 'rgba(255, 248, 239, 0.92)',
    },
    reserved: {
      rail: '#d0a145',
      shell: '#b88b2f',
      fill: '#ffcf5a',
      numberGlow: 'rgba(126, 89, 22, 0.18)',
      outer: '#e4d7b6',
      ink: '#fffefb',
      meta: '#7f6320',
      attentionRing: 'rgba(255, 248, 239, 0.92)',
    },
    occupied: {
      rail: '#61b9b4',
      shell: '#338a86',
      fill: '#43cbc4',
      numberGlow: 'rgba(22, 100, 95, 0.18)',
      outer: '#b9ddda',
      ink: '#ffffff',
      meta: '#296865',
      attentionRing: 'rgba(255, 248, 239, 0.92)',
    },
    attention: {
      rail: '#4fc0bb',
      shell: '#338a86',
      fill: '#43cbc4',
      numberGlow: 'rgba(22, 100, 95, 0.18)',
      outer: '#b9ddda',
      ink: '#ffffff',
      meta: '#296865',
      attentionRing: 'rgba(255, 248, 239, 0.92)',
    },
    cooking: {
      rail: '#5d88d8',
      shell: '#3366bd',
      fill: '#407fff',
      numberGlow: 'rgba(31, 74, 147, 0.18)',
      outer: '#c8d7ef',
      ink: '#ffffff',
      meta: '#2d568f',
      attentionRing: 'rgba(255, 248, 239, 0.92)',
    },
    pending_payment: {
      rail: '#d37b7f',
      shell: '#bf565d',
      fill: '#ff5b64',
      numberGlow: 'rgba(135, 45, 54, 0.18)',
      outer: '#e8c3c7',
      ink: '#ffffff',
      meta: '#84353c',
      attentionRing: 'rgba(255, 248, 239, 0.92)',
    },
    blocked: {
      rail: '#b38b90',
      shell: '#98666d',
      fill: '#cc8188',
      numberGlow: 'rgba(101, 58, 64, 0.18)',
      outer: '#dcc8cb',
      ink: '#ffffff',
      meta: '#73474d',
      attentionRing: 'rgba(255, 248, 239, 0.92)',
    },
  },
};

export function HallTableCard({
  copy,
  table,
  onSelect,
}: {
  copy: ReturnType<typeof getPosCopy>;
  table: DiningTable;
  onSelect: (table: DiningTable) => void;
}) {
  const theme = useTheme();
  const visualState = getTableVisualState(table);
  const palette = tablePalette[theme.palette.mode === 'dark' ? 'dark' : 'light'][visualState];
  const coreShape = getTableCoreShape(table.shapeVariant);
  const metaLabel =
    visualState === 'reserved' || visualState === 'cooking' ? '' : getTableMeta(table, copy, formatElapsedMinutes);
  const markers = getVariantMarkers(table.shapeVariant);
  const isTall = coreShape === 'vertical' || Number(table.height ?? 1) > Number(table.width ?? 1);
  const activeSessionCount = table.activeSessionCount ?? table.activeSessions?.length ?? (table.activeSession ? 1 : 0);
  const activeSessionCountLabel = `x${activeSessionCount}`;

  const numberPlateSx =
    coreShape === 'horizontal'
      ? { width: 92, height: 56, borderRadius: '18px' }
      : coreShape === 'vertical'
        ? { width: 66, height: 94, borderRadius: '20px' }
        : { width: 66, height: 66, borderRadius: '18px' };

  return (
    <Box
      component="button"
      type="button"
      data-testid={`hall-table-${table.tableNumber}`}
      aria-label={table.name}
      onClick={() => onSelect(table)}
      sx={(theme) => ({
        position: 'relative',
        width: '100%',
        height: '100%',
        border: 0,
        p: 0,
        borderRadius: '22px',
        cursor: 'pointer',
        backgroundColor: theme.palette.mode === 'dark' ? alpha(palette.outer, 0.72) : palette.outer,
        color: palette.ink,
        overflow: 'hidden',
        transition: 'transform 0.18s ease, filter 0.18s ease, box-shadow 0.18s ease',
        boxShadow:
          theme.palette.mode === 'dark'
            ? 'inset 0 0 0 1px rgba(255,255,255,0.02)'
            : 'inset 0 0 0 1px rgba(40,51,65,0.06)',
        '&:hover': {
          transform: 'translateY(-2px)',
          filter: 'brightness(1.04)',
          boxShadow:
            theme.palette.mode === 'dark'
              ? 'inset 0 0 0 1px rgba(255,255,255,0.04), 0 12px 24px rgba(0,0,0,0.22)'
              : 'inset 0 0 0 1px rgba(40,51,65,0.08), 0 12px 24px rgba(76,55,31,0.12)',
        },
      })}>
      {markers.map(({ key, width, height, ...seatMarker }) => (
        <Box
          key={key}
          sx={{
            position: 'absolute',
            borderRadius: 999,
            backgroundColor: palette.rail,
            boxShadow: `0 0 18px ${alpha(palette.rail, visualState === 'available' ? 0.08 : 0.18)}`,
            width: width ?? 10,
            height: height ?? 72,
            ...seatMarker,
          }}
        />
      ))}

      <Box
        sx={(theme) => ({
          position: 'absolute',
          inset: isTall ? '12px 24px' : '16px 18px',
          borderRadius: '20px',
          backgroundColor: palette.shell,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: 1.4,
          py: 1.4,
          overflow: 'hidden',
          boxShadow:
            theme.palette.mode === 'dark'
              ? 'inset 0 1px 0 rgba(255,255,255,0.035)'
              : 'inset 0 1px 0 rgba(255,255,255,0.18)',
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(180deg, rgba(255,255,255,0.035) 0%, rgba(255,255,255,0) 38%, rgba(255,255,255,0.02) 100%)',
            pointerEvents: 'none',
          },
        })}>
        <Stack
          alignItems="center"
          justifyContent={metaLabel ? 'space-between' : 'center'}
          sx={{ minHeight: '100%', width: '100%', position: 'relative', zIndex: 1, py: 0.2 }}>
          <Box
            sx={{
              ...numberPlateSx,
              display: 'grid',
              placeItems: 'center',
              backgroundColor: palette.fill,
              color: palette.ink,
              fontSize: coreShape === 'horizontal' ? 20 : 22,
              fontWeight: 700,
              position: 'relative',
              boxShadow: `0 14px 28px ${palette.numberGlow}`,
            }}>
            {table.tableNumber}
            {shouldShowAttentionDot(table) ? (
              <Box
                sx={{
                  position: 'absolute',
                  top: -5,
                  right: -5,
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  backgroundColor: '#ff545a',
                  boxShadow: `0 0 0 4px ${palette.attentionRing}`,
                }}
              />
            ) : null}
            {activeSessionCount > 1 ? (
              <Box
                data-testid={`hall-table-${table.tableNumber}-session-badge`}
                sx={{
                  position: 'absolute',
                  top: -8,
                  right: -8,
                  minWidth: 28,
                  height: 28,
                  px: 0.6,
                  borderRadius: 999,
                  display: 'grid',
                  placeItems: 'center',
                  backgroundColor: '#28313d',
                  color: '#ffffff',
                  fontSize: 12,
                  fontWeight: 900,
                  lineHeight: 1,
                  boxShadow: `0 0 0 4px ${palette.attentionRing}, 0 8px 16px rgba(0,0,0,0.2)`,
                }}>
                {activeSessionCountLabel}
              </Box>
            ) : null}
          </Box>

          {metaLabel ? (
            <Typography
              variant="body2"
              sx={{
                mt: 1,
                fontWeight: 800,
                fontSize: 15,
                color: palette.meta,
                minHeight: 22,
                lineHeight: 1,
              }}>
              {metaLabel}
            </Typography>
          ) : null}
        </Stack>
      </Box>
    </Box>
  );
}
