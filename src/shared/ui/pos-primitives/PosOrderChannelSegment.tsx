import { Box, Stack, Typography, alpha } from '@mui/material';

type Props = {
  hallLabel: string;
  takeawayLabel: string;
  channel: string | null | undefined;
  compact?: boolean;
};

export function PosOrderChannelSegment({ hallLabel, takeawayLabel, channel, compact = false }: Props) {
  const isTakeaway = channel === 'takeaway';

  return (
    <Stack
      direction="row"
      spacing={compact ? 0.55 : 0.8}
      sx={(theme) => ({
        p: compact ? 0.6 : 0.7,
        borderRadius: 999,
        backgroundColor: theme.palette.mode === 'dark' ? '#17181b' : '#e7ddcf',
        boxShadow:
          theme.palette.mode === 'dark'
            ? 'inset 0 0 0 1px rgba(255,255,255,0.03)'
            : 'inset 0 0 0 1px rgba(41,47,56,0.04)',
      })}>
      {[
        { key: 'hall', label: hallLabel, active: !isTakeaway },
        { key: 'takeaway', label: takeawayLabel, active: isTakeaway },
      ].map((item) => (
        <Box
          key={item.key}
          sx={(theme) => ({
            flex: 1,
            minWidth: 0,
            px: compact ? 1.35 : 1.6,
            py: compact ? 0.9 : 1.05,
            borderRadius: 999,
            textAlign: 'center',
            backgroundColor: item.active ? (theme.palette.mode === 'dark' ? '#4a4a4a' : '#5c5c5c') : 'transparent',
            color: item.active
              ? '#ffffff'
              : theme.palette.mode === 'dark'
                ? alpha('#ffffff', 0.72)
                : alpha('#27313d', 0.68),
            transition: 'background-color 0.18s ease, color 0.18s ease',
          })}>
          <Typography
            variant={compact ? 'body2' : 'subtitle1'}
            sx={{
              fontWeight: 700,
              lineHeight: 1.15,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
            {item.label}
          </Typography>
        </Box>
      ))}
    </Stack>
  );
}
