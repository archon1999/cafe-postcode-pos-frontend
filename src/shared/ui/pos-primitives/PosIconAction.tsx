import type { MouseEventHandler } from 'react';

import { Icon } from '@iconify/react';
import { Button, alpha } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';

export function PosIconAction({
  icon,
  onClick,
  sx,
}: {
  icon: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  sx?: SxProps<Theme>;
}) {
  return (
    <Button
      variant="contained"
      onClick={onClick}
      sx={[
        (theme) => ({
          minWidth: { xs: 46, sm: 52, md: 60 },
          width: { xs: 46, sm: 52, md: 60 },
          height: { xs: 46, sm: 52, md: 60 },
          p: 0,
          color: 'text.primary',
          backgroundImage: 'none',
          borderRadius: { xs: '14px', md: '18px' },
          backgroundColor: theme.palette.mode === 'dark' ? alpha('#2b2e33', 0.58) : alpha('#ffffff', 0.84),
          backdropFilter: 'blur(20px) saturate(138%)',
          border: `1px solid ${alpha('#ffffff', theme.palette.mode === 'dark' ? 0.08 : 0.22)}`,
          boxShadow:
            theme.palette.mode === 'dark'
              ? 'inset 0 1px 0 rgba(255,255,255,0.04), 0 10px 22px rgba(0,0,0,0.2)'
              : '0 10px 24px rgba(67,47,28,0.12)',
          '&:hover': {
            backgroundColor: theme.palette.mode === 'dark' ? alpha('#353942', 0.7) : alpha('#ffffff', 0.92),
          },
        }),
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    >
      <Icon icon={icon} width={20} />
    </Button>
  );
}
