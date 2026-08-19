import { Icon } from '@iconify/react';
import { Box, Button, CircularProgress, Paper, Stack, Typography } from '@mui/material';
import { useState } from 'react';

import { getPosCopy } from 'shared/locale/copy';
import { PosLogo } from 'shared/ui/PosLogo';

import { usePosSession } from '../session-context';

export function DeviceRevokedPage() {
  const { device, deviceError, forgetRevokedDevice, locale, retryDeviceConnection } = usePosSession();
  const copy = getPosCopy(locale);
  const [pending, setPending] = useState(false);

  const run = async (action: () => Promise<void>) => {
    setPending(true);
    try {
      await action();
    } finally {
      setPending(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', px: 2, bgcolor: 'background.default' }}>
      <Paper elevation={0} sx={{ width: 'min(100%, 580px)', p: { xs: 3, md: 5 }, borderRadius: 4 }}>
        <Stack spacing={2.5} alignItems="center" textAlign="center">
          <PosLogo isSingle={false} sx={{ width: 170, height: 48 }} />
          <Icon icon="solar:shield-warning-bold-duotone" width={76} />
          <Typography variant="h4" fontWeight={800}>
            {copy.deviceRevokedTitle}
          </Typography>
          <Typography color="text.secondary">
            {deviceError || 'Bu terminalning ulanishi faol emas. Superadmin qurilmalar ro‘yxatini tekshirishi kerak.'}
          </Typography>
          {device ? (
            <Typography variant="body2" color="text.secondary">
              {device.name} · {device.id}
            </Typography>
          ) : null}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} width="100%">
            <Button fullWidth variant="contained" disabled={pending} onClick={() => void run(retryDeviceConnection)}>
              {pending ? <CircularProgress size={22} /> : copy.deviceRetry}
            </Button>
            <Button fullWidth variant="outlined" disabled={pending} onClick={() => void run(forgetRevokedDevice)}>
              {copy.deviceRePair}
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
}
