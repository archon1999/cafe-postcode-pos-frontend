import { Box, Stack, Typography, alpha } from '@mui/material';

type OrderChannelSegmentValue = 'hall' | 'delivery' | 'takeaway';

type Props = {
  hallLabel?: string;
  takeawayLabel: string;
  deliveryLabel?: string;
  channel: string | null | undefined;
  compact?: boolean;
  disabled?: boolean;
  items?: Array<{
    value: OrderChannelSegmentValue;
    label: string;
  }>;
  onChange?: (channel: OrderChannelSegmentValue) => void;
};

export function PosOrderChannelSegment({
  hallLabel,
  takeawayLabel,
  deliveryLabel,
  channel,
  compact = false,
  disabled = false,
  items,
  onChange,
}: Props) {
  const segmentItems =
    items ??
    [
      hallLabel ? { value: 'hall' as const, label: hallLabel } : null,
      { value: 'takeaway' as const, label: takeawayLabel },
      deliveryLabel ? { value: 'delivery' as const, label: deliveryLabel } : null,
    ].filter((item): item is { value: OrderChannelSegmentValue; label: string } => Boolean(item));
  const activeChannel = channel === 'delivery' || channel === 'takeaway' ? channel : 'hall';

  return (
    <Stack
      direction="row"
      spacing={compact ? 0.55 : 0.8}
      sx={(theme) => ({
        p: compact ? 0.6 : 0.7,
        borderRadius: 999,
        backgroundColor: 'var(--pos-segment-bg)',
        boxShadow:
          theme.palette.mode === 'dark'
            ? 'inset 0 0 0 1px var(--pos-segment-border)'
            : 'inset 0 0 0 1px var(--pos-segment-border)',
      })}>
      {segmentItems.map((item) => (
        <Box
          key={item.value}
          aria-pressed={item.value === activeChannel}
          component={onChange ? 'button' : 'div'}
          disabled={onChange ? disabled : undefined}
          type={onChange ? 'button' : undefined}
          onClick={onChange && !disabled ? () => onChange(item.value) : undefined}
          sx={(theme) => ({
            flex: 1,
            minWidth: 0,
            border: 0,
            px: compact ? 1.35 : 1.6,
            py: compact ? 0.9 : 1.05,
            borderRadius: 999,
            textAlign: 'center',
            font: 'inherit',
            cursor: onChange && !disabled ? 'pointer' : 'default',
            backgroundColor: item.value === activeChannel ? 'var(--pos-segment-active-bg)' : 'transparent',
            color:
              item.value === activeChannel
                ? 'var(--pos-segment-active-color)'
                : theme.palette.mode === 'dark'
                  ? alpha('#ffffff', 0.72)
                  : alpha('#27313d', 0.68),
            opacity: disabled && item.value !== activeChannel ? 0.58 : 1,
            transition: 'background-color 0.18s ease, color 0.18s ease',
            '&:focus-visible': {
              outline: `2px solid ${theme.palette.primary.main}`,
              outlineOffset: 2,
            },
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
