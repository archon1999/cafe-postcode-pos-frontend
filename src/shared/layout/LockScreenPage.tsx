import { Box, Button, Stack, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

import { usePosSession } from 'modules/auth';

import { getPosCopy } from '../locale/copy';
import { formatDateLabel } from '../pos/utils';

export function LockScreenPage() {
  const navigate = useNavigate();
  const { changeUser, locale, session } = usePosSession();
  const copy = getPosCopy(locale);
  const [currentTime, setCurrentTime] = useState(() => new Date());

  useEffect(() => {
    const intervalId = window.setInterval(() => setCurrentTime(new Date()), 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <Box
      onClick={() => navigate('/pin-login')}
      sx={{
        minHeight: '100vh',
        backgroundImage:
          'linear-gradient(180deg, rgba(18,18,18,0.12) 0%, rgba(18,18,18,0.42) 100%), url(/pos-auth-bg-source.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center center',
        display: 'grid',
        placeItems: 'center',
        px: 3,
        cursor: 'pointer',
      }}>
      <Stack spacing={1.5} alignItems="center" textAlign="center">
        <Typography sx={{ fontSize: { xs: 86, md: 156 }, lineHeight: 0.92, color: '#f4f4f4', fontWeight: 300 }}>
          {currentTime.toLocaleTimeString(locale === 'ru' ? 'ru-RU' : 'uz-UZ', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Typography>
        <Typography sx={{ fontSize: { xs: 24, md: 34 }, color: 'rgba(255,255,255,0.88)' }}>
          {formatDateLabel(currentTime, locale)}
        </Typography>
        <Typography variant="h6" sx={{ color: 'rgba(255,255,255,0.8)', mt: 4 }}>
          {session?.user.fullName}
        </Typography>
        <Stack direction="row" spacing={1.5} sx={{ mt: 3 }}>
          <Button variant="contained" onClick={() => navigate('/pin-login')}>
            {copy.unlock}
          </Button>
          <Button
            variant="contained"
            onClick={(event) => {
              event.stopPropagation();
              void changeUser().then(() => navigate('/pin-login', { replace: true }));
            }}
            sx={{
              backgroundColor: 'rgba(255,255,255,0.18)',
              color: '#ffffff',
            }}>
            {copy.changeUser}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
