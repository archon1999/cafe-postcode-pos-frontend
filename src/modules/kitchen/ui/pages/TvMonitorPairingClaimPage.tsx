/* eslint-disable i18next/no-literal-string */
import { Alert, Box, Button, CircularProgress, Paper, Stack, Typography } from '@mui/material';
import axios from 'axios';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router';

import { usePosSession } from 'modules/auth';
import { kitchenRepository } from 'modules/kitchen/data-access';

export function TvMonitorPairingClaimPage() {
  const { pairingId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { setSession } = usePosSession();
  const claimToken = searchParams.get('token') ?? '';
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [restaurantName, setRestaurantName] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const claimStartedRef = useRef(false);
  const isLinkValid = Boolean(pairingId && claimToken);

  const connectTv = useCallback(async () => {
    if (!isLinkValid || claimStartedRef.current) return;

    claimStartedRef.current = true;
    setIsSubmitting(true);
    setErrorMessage('');
    try {
      const result = await kitchenRepository.claimTvMonitorPairing(pairingId, claimToken);
      setRestaurantName(result.restaurantName);
    } catch (error) {
      claimStartedRef.current = false;
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        setSession(null);
        const next = encodeURIComponent(`${location.pathname}${location.search}`);
        void navigate(`/pin-login?next=${next}`, { replace: true });
        return;
      }
      if (axios.isAxiosError(error) && error.response?.status === 410) {
        setErrorMessage('QR-kodning muddati tugagan. TV ekranidagi yangi QR-kodni skanerlang.');
      } else {
        setErrorMessage('QR-kod yaroqsiz. TV ekranidagi QR-kodni qayta skanerlang.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [claimToken, isLinkValid, location.pathname, location.search, navigate, pairingId, setSession]);

  useEffect(() => {
    if (isLinkValid) void connectTv();
  }, [connectTv, isLinkValid]);

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        p: 2,
        background: 'linear-gradient(160deg, #eef5ff 0%, #f8f5ef 100%)',
      }}>
      <Paper elevation={8} sx={{ width: 'min(100%, 440px)', p: { xs: 3, sm: 4 }, borderRadius: 4 }}>
        {restaurantName ? (
          <Stack spacing={2} alignItems="center" textAlign="center">
            <Typography sx={{ fontSize: 54 }}>✓</Typography>
            <Typography variant="h4" fontWeight={800}>
              TV ulandi
            </Typography>
            <Typography color="text.secondary">
              {restaurantName} monitori tayyor. Bu sahifani yopishingiz mumkin.
            </Typography>
          </Stack>
        ) : (
          <Stack spacing={2.5} alignItems="center" textAlign="center">
            <Typography variant="h4" fontWeight={800}>
              TV’ni ulash
            </Typography>

            {!isLinkValid ? <Alert severity="error">QR-kod yaroqsiz. TV ekranidan qayta skanerlang.</Alert> : null}
            {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}

            {isSubmitting ? (
              <>
                <CircularProgress size={46} />
                <Typography color="text.secondary">TV restoraningizga ulanmoqda…</Typography>
              </>
            ) : null}

            {errorMessage ? (
              <Button
                variant="contained"
                size="large"
                onClick={() => void connectTv()}
                sx={{ minHeight: 52, borderRadius: 2.5 }}>
                Qayta urinish
              </Button>
            ) : null}
          </Stack>
        )}
      </Paper>
    </Box>
  );
}
