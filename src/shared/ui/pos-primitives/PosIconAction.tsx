import { Icon } from '@iconify/react';
import { Box, Button, alpha } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import type { MouseEventHandler } from 'react';

import { useCashierContextQuery } from 'modules/cashier/application';

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
  const fiscalStatusQuery = useCashierContextQuery({
    enabled: isSettingsAction,
    refetchInterval: isSettingsAction ? 30000 : false,
  });
  const isFiscalOnline = Boolean(fiscalStatusQuery.data?.fiscalDeviceStatus?.online);
  const badgeColor = fiscalStatusQuery.isError ? '#ff5963' : isFiscalOnline ? '#21c985' : '#ffb020';

  return (
    <Button
      variant="contained"
      onClick={onClick}
      sx={[
        (theme) => ({
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
