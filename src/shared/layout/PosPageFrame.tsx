import { Box, Stack } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import type { ReactNode } from 'react';

export function PosPageFrame({
  children,
  contentSx,
  header,
  headerSx,
  sx,
}: {
  children: ReactNode;
  contentSx?: SxProps<Theme>;
  header: ReactNode;
  headerSx?: SxProps<Theme>;
  sx?: SxProps<Theme>;
}) {
  return (
    <Stack spacing={{ xs: 2, md: 2.5 }} sx={[{ height: '100%', minHeight: 0, overflow: 'hidden' }, sx]}>
      <Box sx={[{ flexShrink: 0 }, headerSx]}>{header}</Box>
      <Box
        sx={[
          {
            flex: '1 1 0',
            minHeight: 0,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          },
          contentSx,
        ]}
      >
        {children}
      </Box>
    </Stack>
  );
}
