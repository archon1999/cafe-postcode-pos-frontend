import { Icon } from '@iconify/react';
import { Box, Button, alpha } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import type { MouseEventHandler } from 'react';

import { deriveSystemHealthTone, systemHealthToneColors, useSystemHealthQuery } from 'shared/system-health';

export function PosIconAction({
  icon,
  onClick,
  sx,
}: {
  icon: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  sx?: SxProps<Theme>;
}) {
  const isSettingsAction = icon.includes('settings');
  const systemHealthQuery = useSystemHealthQuery({ enabled: isSettingsAction });
  const badgeTone = deriveSystemHealthTone(
    systemHealthQuery.data?.status,
    systemHealthQuery.isError || systemHealthQuery.isRefetchError,
    { ignoreSync: true },
  );
  const badgeColor = systemHealthToneColors[badgeTone];

  return (
    <Button
      variant="contained"
      aria-label={isSettingsAction ? 'Sozlamalar' : undefined}
      onClick={onClick}
      sx={[
        () => ({
          position: 'relative',
          minWidth: { xs: 46, sm: 50, md: 52, xl: 60 },
          width: { xs: 46, sm: 50, md: 52, xl: 60 },
          height: { xs: 46, sm: 50, md: 52, xl: 60 },
          p: 0,
          color: 'text.primary',
          backgroundImage: 'none',
          borderRadius: { xs: '14px', md: '18px' },
          background: 'var(--pos-action-bg)',
          backdropFilter: 'blur(20px) saturate(138%)',
          border: '1px solid var(--pos-action-border)',
          boxShadow: 'var(--pos-action-shadow)',
          '&:hover': {
            background: 'var(--pos-action-hover-bg)',
          },
        }),
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}>
      <Icon icon={icon} width={20} />
      {isSettingsAction ? (
        <Box
          sx={{
            position: 'absolute',
            top: { xs: 5, md: 7 },
            right: { xs: 5, md: 7 },
            width: { xs: 10, md: 12 },
            height: { xs: 10, md: 12 },
            borderRadius: 999,
            backgroundColor: badgeColor,
            border: '2px solid',
            borderColor: 'background.paper',
            boxShadow: `0 0 0 3px ${alpha(badgeColor, 0.2)}`,
          }}
        />
      ) : null}
    </Button>
  );
}
