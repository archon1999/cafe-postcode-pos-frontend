import { Icon } from '@iconify/react';
import { Box, IconButton, Stack, alpha } from '@mui/material';

import { HALL_MAP_MAX_SCALE, HALL_MAP_MIN_SCALE, type HallMapScaleMode } from './hallMapScale';

type Props = {
  scale: number;
  scaleMode: HallMapScaleMode;
  onFitFillToggle: () => void;
  onZoom: (direction: -1 | 1) => void;
};

export function HallMapZoomControls({ scale, scaleMode, onFitFillToggle, onZoom }: Props) {
  return (
    <Stack
      direction="row"
      spacing={0.45}
      sx={(theme) => ({
        flexShrink: 0,
        alignItems: 'center',
        p: 0.35,
        borderRadius: { xs: '14px', md: '16px' },
        backgroundColor: theme.palette.mode === 'dark' ? alpha('#151719', 0.72) : alpha('#ffffff', 0.86),
        border: `1px solid ${alpha('#ffffff', theme.palette.mode === 'dark' ? 0.06 : 0.5)}`,
        boxShadow: theme.palette.mode === 'dark' ? '0 14px 28px rgba(0,0,0,0.22)' : '0 14px 28px rgba(65, 46, 24, 0.1)',
        backdropFilter: 'blur(16px)',
      })}>
      <IconButton
        aria-label="Xaritani kichraytirish"
        size="small"
        disabled={scale <= HALL_MAP_MIN_SCALE + 0.01}
        onClick={() => onZoom(-1)}>
        <Icon icon="solar:minus-circle-bold-duotone" width={22} />
      </IconButton>
      <Box
        sx={{
          minWidth: { xs: 42, md: 48 },
          display: 'grid',
          placeItems: 'center',
          fontSize: { xs: 12, md: 13 },
          fontWeight: 800,
          color: 'text.secondary',
        }}>
        {Math.round(scale * 100)}%
      </Box>
      <IconButton
        aria-label="Xaritani kattalashtirish"
        size="small"
        disabled={scale >= HALL_MAP_MAX_SCALE - 0.01}
        onClick={() => onZoom(1)}>
        <Icon icon="solar:add-circle-bold-duotone" width={22} />
      </IconButton>
      <IconButton
        aria-label={scaleMode === 'fill' ? "Xaritani sig'dirish" : "Xaritani kenglikka to'ldirish"}
        size="small"
        onClick={onFitFillToggle}>
        <Icon
          icon={
            scaleMode === 'fill'
              ? 'solar:quit-full-screen-square-bold-duotone'
              : 'solar:full-screen-square-bold-duotone'
          }
          width={22}
        />
      </IconButton>
    </Stack>
  );
}
