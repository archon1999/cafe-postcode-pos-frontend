import { Box, Stack, Typography } from '@mui/material';

export function PosLegendPill({ label, color }: { label: string; color: string }) {
  return (
    <Stack
      direction="row"
      spacing={1.1}
      alignItems="center"
      sx={{
        px: 1.18,
        py: 0.68,
        borderRadius: 999,
        backgroundColor: 'var(--pos-legend-bg)',
      }}>
      <Box sx={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: color }} />
      <Typography
        variant="body2"
        sx={(theme) => ({
          fontSize: 13.5,
          fontWeight: 600,
          color: theme.palette.mode === 'dark' ? '#a6abb2' : theme.palette.text.secondary,
        })}>
        {label}
      </Typography>
    </Stack>
  );
}
