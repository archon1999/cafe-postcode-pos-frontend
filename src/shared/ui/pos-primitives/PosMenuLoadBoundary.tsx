import { Alert, Box, Button } from '@mui/material';
import type { ReactNode } from 'react';

import { getPosCopy, type PosLocale } from 'shared/locale/copy';

export function PosMenuLoadBoundary({
  failed,
  hasData,
  isFetching,
  locale,
  onRetry,
  children,
}: {
  failed: boolean;
  hasData: boolean;
  isFetching: boolean;
  locale: PosLocale;
  onRetry: () => void;
  children: ReactNode;
}) {
  if (!failed) return children;
  const copy = getPosCopy(locale);
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <Box sx={{ p: 2 }}>
        <Alert
          severity={hasData ? 'warning' : 'error'}
          action={
            <Button color="inherit" disabled={isFetching} onClick={onRetry} size="small">
              {copy.refresh}
            </Button>
          }>
          {hasData ? copy.menuRefreshFailed : copy.menuLoadFailed}
        </Alert>
      </Box>
      {hasData && <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>{children}</Box>}
    </Box>
  );
}
