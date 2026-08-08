/* eslint-disable i18next/no-literal-string */
import { Box, Button, CircularProgress, Stack, Typography, alpha } from '@mui/material';

export type TvAudioUnlockState = 'required' | 'enabling' | 'error';

export function TvAudioUnlockOverlay({
  state,
  error,
  onEnable,
}: {
  state: TvAudioUnlockState;
  error: string;
  onEnable: () => void;
}) {
  const enabling = state === 'enabling';

  return (
    <Box
      data-testid="tv-audio-unlock-overlay"
      sx={{
        position: 'fixed',
        zIndex: 4000,
        inset: 0,
        display: 'grid',
        placeItems: 'center',
        p: 3,
        color: '#f7f9fc',
        backgroundColor: 'rgba(7, 10, 16, 0.82)',
        backdropFilter: 'blur(14px)',
      }}>
      <Stack
        alignItems="center"
        spacing={2.25}
        sx={{
          width: 'min(680px, 92vw)',
          p: { xs: 3, sm: 5 },
          textAlign: 'center',
          borderRadius: 4,
          border: `1px solid ${alpha('#59a6ff', 0.34)}`,
          background: 'linear-gradient(160deg, rgba(34, 48, 72, 0.97), rgba(15, 20, 29, 0.98))',
          boxShadow: '0 28px 100px rgba(0, 0, 0, 0.55), 0 0 70px rgba(64, 145, 255, 0.12)',
        }}>
        <Box
          aria-hidden="true"
          sx={{
            width: 84,
            height: 84,
            display: 'grid',
            placeItems: 'center',
            borderRadius: '50%',
            color: '#7fbcff',
            fontSize: 46,
            lineHeight: 1,
            border: `1px solid ${alpha('#7fbcff', 0.34)}`,
            backgroundColor: alpha('#368ae8', 0.14),
            boxShadow: `0 0 42px ${alpha('#368ae8', 0.2)}`,
          }}>
          <Box sx={{ position: 'relative', width: 50, height: 46 }}>
            <Box
              sx={{
                position: 'absolute',
                left: 1,
                top: 9,
                width: 28,
                height: 28,
                backgroundColor: 'currentColor',
                clipPath: 'polygon(0 30%, 34% 30%, 82% 0, 82% 100%, 34% 70%, 0 70%)',
              }}
            />
            {[0, 1].map((wave) => (
              <Box
                key={wave}
                sx={{
                  position: 'absolute',
                  left: 24 + wave * 5,
                  top: 9 - wave * 5,
                  width: 13 + wave * 9,
                  height: 28 + wave * 10,
                  borderRight: `${3 + wave}px solid currentColor`,
                  borderRadius: '50%',
                }}
              />
            ))}
          </Box>
        </Box>

        <Stack spacing={1}>
          <Typography sx={{ fontSize: { xs: 34, sm: 48 }, fontWeight: 850, lineHeight: 1.05 }}>
            Ovozni yoqish
          </Typography>
          <Typography sx={{ color: alpha('#fff', 0.68), fontSize: { xs: 18, sm: 23 }, lineHeight: 1.35 }}>
            Buyurtma tayyor bo‘lganda televizor ovozli e’lon beradi
          </Typography>
        </Stack>

        {error ? (
          <Typography data-testid="tv-audio-unlock-error" sx={{ color: '#ff9da2', fontSize: 17 }}>
            {error}
          </Typography>
        ) : null}

        <Button
          autoFocus
          data-testid="tv-audio-unlock-button"
          variant="contained"
          size="large"
          disabled={enabling}
          onClick={onEnable}
          sx={{
            minWidth: { xs: 240, sm: 320 },
            minHeight: 68,
            px: 4,
            borderRadius: 2.5,
            fontSize: { xs: 20, sm: 24 },
            fontWeight: 850,
            textTransform: 'none',
            background: 'linear-gradient(135deg, #287ad7, #1ba88e)',
          }}>
          {enabling ? <CircularProgress size={30} color="inherit" /> : state === 'error' ? 'Qayta urinish' : 'Yoqish'}
        </Button>

        <Typography sx={{ color: alpha('#fff', 0.46), fontSize: 15 }}>
          TV pulti yoki sichqoncha bilan bir marta bosing
        </Typography>
      </Stack>
    </Box>
  );
}
