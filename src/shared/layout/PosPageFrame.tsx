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
  const rootSx = [{ height: '100%', minHeight: 0, overflow: 'visible' }, ...(sx ? [sx] : [])] as SxProps<Theme>;
  const resolvedHeaderSx = [{ flexShrink: 0, overflow: 'visible' }, ...(headerSx ? [headerSx] : [])] as SxProps<Theme>;
  const resolvedContentSx = [
    {
      flex: '1 1 0',
      minHeight: 0,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    },
    ...(contentSx ? [contentSx] : []),
  ] as SxProps<Theme>;

  return (
    <Stack spacing={{ xs: 2, md: 2.5 }} sx={rootSx}>
      <Box sx={resolvedHeaderSx}>{header}</Box>
      <Box sx={resolvedContentSx}>{children}</Box>
    </Stack>
  );
}
