import { Stack, Typography } from '@mui/material';

export function PosLocationHeading({
  zone,
  hall,
  compact = false,
  inline = false,
}: {
  zone?: string | null;
  hall?: string | null;
  compact?: boolean;
  inline?: boolean;
}) {
  const zoneLabel = zone?.trim();
  const hallLabel = hall?.trim();
  if (!zoneLabel && !hallLabel) return null;

  if (inline) {
    const showZone = zoneLabel && zoneLabel.toLocaleLowerCase() !== hallLabel?.toLocaleLowerCase();
    return (
      <Typography noWrap data-location-emphasis="true" sx={{ minWidth: 0, fontSize: 16, lineHeight: 1.4 }}>
        {hallLabel ? (
          <Typography component="span" data-location-level="hall" sx={{ fontSize: 'inherit', fontWeight: 650 }}>
            {hallLabel}
          </Typography>
        ) : null}
        {showZone ? (
          <Typography component="span" color="text.secondary" sx={{ fontSize: 13, fontWeight: 400 }}>
            {hallLabel ? ' · ' : ''}
            <span data-location-level="zone">{zoneLabel}</span>
          </Typography>
        ) : null}
      </Typography>
    );
  }

  return (
    <Stack spacing={0.35} data-location-emphasis="true" sx={{ minWidth: 0 }}>
      {zoneLabel && zoneLabel.toLocaleLowerCase() !== hallLabel?.toLocaleLowerCase() ? (
        <Typography
          component="span"
          color="text.secondary"
          data-location-level="zone"
          noWrap
          title={zoneLabel}
          sx={{ fontSize: compact ? 12 : 13, fontWeight: 500, lineHeight: 1.4, letterSpacing: '0.02em' }}>
          {zoneLabel}
        </Typography>
      ) : null}
      {hallLabel ? (
        <Typography
          component="span"
          data-location-level="hall"
          noWrap
          title={hallLabel}
          sx={{ fontSize: compact ? 16 : 20, fontWeight: 700, lineHeight: 1.25, letterSpacing: '-0.01em' }}>
          {hallLabel}
        </Typography>
      ) : null}
    </Stack>
  );
}
