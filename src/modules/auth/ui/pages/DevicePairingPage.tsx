import { Icon } from '@iconify/react';
import { Box, Button, CircularProgress, Paper, Stack, Typography, alpha } from '@mui/material';
import QRCode from 'qrcode';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { getPosCopy } from 'shared/locale/copy';
import { PosLogo } from 'shared/ui/PosLogo';

import { usePosSession } from '../session-context';

function pairingClaimUrl(pairingId: string, claimToken: string) {
  const url = new URL(String(import.meta.env.VITE_CONTROL_APP_URL || 'https://control.cafe-postcode.uz'));
  const basePath = url.pathname.replace(/\/+$/, '');
  url.pathname = `${basePath.endsWith('/control') ? basePath : `${basePath}/control`}/pair`;
  url.hash = new URLSearchParams({ v: '1', pairingId, claimToken }).toString();
  return url.toString();
}

export function DevicePairingPage() {
  const { authState, cancelPairing, deviceError, locale, pairing, refreshPairing, startPairing } = usePosSession();
  const copy = getPosCopy(locale);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [actionPending, setActionPending] = useState(false);
  const requested = useRef(false);
  const polling = useRef(false);
  const autoRestartedPairing = useRef<string | null>(null);
  const claimUrl = useMemo(() => (pairing ? pairingClaimUrl(pairing.id, pairing.claimToken) : ''), [pairing]);

  useEffect(() => {
    if ((authState === 'UNPAIRED' || (authState === 'PAIRING' && !pairing)) && !requested.current) {
      requested.current = true;
      setActionPending(true);
      void startPairing()
        .catch(() => undefined)
        .finally(() => setActionPending(false));
    }
  }, [authState, pairing, startPairing]);

  useEffect(() => {
    if (!claimUrl) {
      setQrDataUrl('');
      return;
    }
    let active = true;
    void QRCode.toDataURL(claimUrl, { width: 420, margin: 2, errorCorrectionLevel: 'M' }).then((value) => {
      if (active) setQrDataUrl(value);
    });
    return () => {
      active = false;
    };
  }, [claimUrl]);

  useEffect(() => {
    if (!pairing || pairing.status !== 'PENDING') return;
    const updateCountdown = () => {
      setSecondsLeft(Math.max(0, Math.ceil((Date.parse(pairing.expiresAt) - Date.now()) / 1000)));
    };
    updateCountdown();
    const countdownId = window.setInterval(updateCountdown, 1_000);
    const pollId = window.setInterval(() => {
      if (polling.current) return;
      polling.current = true;
      void refreshPairing()
        .catch(() => undefined)
        .finally(() => {
          polling.current = false;
        });
    }, 2_000);
    return () => {
      window.clearInterval(countdownId);
      window.clearInterval(pollId);
    };
  }, [pairing, refreshPairing]);

  const restart = useCallback(async () => {
    setActionPending(true);
    try {
      await cancelPairing();
      requested.current = true;
      await startPairing();
    } finally {
      setActionPending(false);
    }
  }, [cancelPairing, startPairing]);

  useEffect(() => {
    if (
      !pairing ||
      pairing.status !== 'PENDING' ||
      Date.parse(pairing.expiresAt) > Date.now() ||
      actionPending ||
      autoRestartedPairing.current === pairing.id
    ) {
      return;
    }
    autoRestartedPairing.current = pairing.id;
    void restart();
  }, [actionPending, pairing, restart, secondsLeft]);

  return (
    <Box
      sx={(theme) => ({
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        px: 2,
        py: { xs: 1.5, md: 4 },
        background:
          theme.palette.mode === 'dark'
            ? 'radial-gradient(circle at 20% 10%, #283749 0%, #15181d 42%, #0d0f12 100%)'
            : 'radial-gradient(circle at 20% 10%, #fff8e9 0%, #f4eee4 48%, #e8e0d3 100%)',
      })}>
      <Paper
        elevation={0}
        sx={(theme) => ({
          width: 'min(100%, 980px)',
          p: { xs: 2, md: 5 },
          borderRadius: 4,
          border: `1px solid ${alpha(theme.palette.common.white, theme.palette.mode === 'dark' ? 0.1 : 0.35)}`,
        })}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={{ xs: 2, md: 6 }} alignItems="center">
          <Stack spacing={{ xs: 1.25, md: 2.25 }} sx={{ flex: 1, minWidth: 0 }}>
            <PosLogo isSingle={false} sx={{ width: { xs: 155, md: 185 }, height: { xs: 44, md: 52 } }} />
            <Typography
              variant="h3"
              sx={{ fontWeight: 800, letterSpacing: '-0.04em', fontSize: { xs: 32, sm: 38, md: 48 } }}>
              {copy.devicePairingTitle}
            </Typography>
            <Typography color="text.secondary" sx={{ fontSize: 17, lineHeight: 1.65 }}>
              {copy.devicePairingDescription}
            </Typography>

            <Stack spacing={1.2} sx={{ display: { xs: 'none', md: 'flex' } }}>
              {[
                'Qurilma kaliti shu terminalda saqlanadi va tashqariga chiqarilmaydi.',
                'QR kod 5 daqiqada tugaydi va faqat bir marta ishlaydi.',
                'Ulangandan keyin xodimlar odatdagidek 4 xonali PIN bilan kiradi.',
              ].map((line) => (
                <Stack key={line} direction="row" spacing={1} alignItems="center">
                  <Box height={24} width={24}>
                    <Icon icon="solar:shield-check-bold-duotone" width={24} />
                  </Box>
                  <Typography variant="body1">{line}</Typography>
                </Stack>
              ))}
            </Stack>

            {deviceError ? <Typography color="error.main">{deviceError}</Typography> : null}
            {pairing?.status === 'REJECTED' || pairing?.status === 'EXPIRED' || secondsLeft === 0 ? (
              <Button
                variant="contained"
                onClick={() => void restart()}
                disabled={actionPending}
                sx={{ alignSelf: 'flex-start' }}>
                {copy.devicePairingRetry}
              </Button>
            ) : null}
          </Stack>

          <Stack alignItems="center" spacing={1.25} sx={{ width: { xs: '100%', md: 420 } }}>
            {pairing ? (
              <Stack alignItems="center" spacing={0.25}>
                <Typography variant="overline" color="text.secondary">
                  {copy.devicePairingCode}
                </Typography>
                <Typography
                  variant="h3"
                  sx={{
                    fontFamily: 'monospace',
                    fontSize: { xs: 36, sm: 44, md: 48 },
                    letterSpacing: '0.16em',
                    fontWeight: 800,
                  }}>
                  {pairing.displayCode}
                </Typography>
                <Typography color={secondsLeft <= 30 ? 'error.main' : 'text.secondary'}>
                  {secondsLeft > 0
                    ? `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`
                    : 'Muddati tugadi'}
                </Typography>
              </Stack>
            ) : (
              <Typography color="text.secondary">{copy.deviceKeyGenerating}</Typography>
            )}
            <Box
              sx={{
                width: { xs: 'min(100%, 52dvh, 340px)', md: 'min(100%, 420px)' },
                aspectRatio: '1',
                borderRadius: 3,
                bgcolor: '#ffffff',
                p: 1.5,
                display: 'grid',
                placeItems: 'center',
              }}>
              {qrDataUrl && pairing?.status === 'PENDING' ? (
                <Box component="img" src={qrDataUrl} alt="POS qurilmasini ulash QR kodi" sx={{ width: '100%' }} />
              ) : (
                <CircularProgress />
              )}
            </Box>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
}
