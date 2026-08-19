import { Box, CircularProgress, Stack, Typography } from '@mui/material';

import { getPosCopy } from 'shared/locale/copy';
import { PosLogo } from 'shared/ui/PosLogo';

import { usePosSession } from '../session-context';

export function DeviceBootstrapPage() {
  const { locale } = usePosSession();
  const copy = getPosCopy(locale);
  return (
    <Box sx={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', bgcolor: 'background.default' }}>
      <Stack spacing={2.5} alignItems="center">
        <PosLogo isSingle={false} sx={{ width: 180, height: 50 }} />
        <CircularProgress />
        <Typography color="text.secondary">{copy.deviceBootstrap}</Typography>
      </Stack>
    </Box>
  );
}
