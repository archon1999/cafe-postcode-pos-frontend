import { Icon } from '@iconify/react';
import { Box, Button, Stack, TextField, Typography, alpha } from '@mui/material';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { getPosCopy, localeLabels } from 'shared/locale/copy';
import { PosLogo } from 'shared/ui/PosLogo';

import { useRestaurantCodeMutation } from '../../application';
import { resolvePosAuthBackgroundImage } from '../auth-background';
import { resolveAuthNextPath } from '../next-path';
import { usePosSession } from '../session-context';

export function RestaurantLoginPageContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const { locale, setLocale, setRestaurantContext, themeMode, setThemeMode } = usePosSession();
  const copy = getPosCopy(locale);
  const [code, setCode] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const authBackgroundImage = resolvePosAuthBackgroundImage(null);

  const loginMutation = useRestaurantCodeMutation({
    onSuccess: (response) => {
      setErrorMessage('');
      setRestaurantContext(response);
      navigate(resolveAuthNextPath(location.search), { replace: true });
    },
    onError: (error) => {
      setErrorMessage(error.message || copy.invalidPin);
    },
  });

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.42fr) minmax(520px, 0.96fr)' },
        backgroundColor: '#1a1c1f',
      }}>
      <Box
        sx={{
          display: { xs: 'none', lg: 'block' },
          minHeight: '100vh',
          position: 'relative',
          overflow: 'hidden',
          backgroundImage: `url(${authBackgroundImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center center',
          backgroundRepeat: 'no-repeat',
        }}
      />

      <Box
        sx={(theme) => ({
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: { xs: 2.5, sm: 4.5 },
          py: 4,
          backgroundColor: theme.palette.mode === 'dark' ? '#1b1d20' : '#f7f1e7',
          borderLeft: {
            lg: `1px solid ${alpha('#ffffff', theme.palette.mode === 'dark' ? 0.04 : 0.18)}`,
          },
        })}>
        <Stack spacing={3} sx={{ width: '100%', maxWidth: 440 }}>
          <Stack direction="row" justifyContent="space-between" spacing={2}>
            <Stack spacing={1}>
              <PosLogo isSingle={false} sx={{ width: 178, height: 50, mb: 0.25 }} />
              <Typography
                variant="h3"
                sx={{
                  fontSize: { xs: 44, lg: 54 },
                  lineHeight: 1.02,
                  letterSpacing: '-0.04em',
                }}>
                {copy.signInTitle}
              </Typography>
              <Typography color="text.secondary" sx={{ maxWidth: 360, fontSize: 16, lineHeight: 1.5 }}>
                {copy.restaurantCodeHelp}
              </Typography>
            </Stack>

            <Button
              variant="contained"
              onClick={() => setThemeMode(themeMode === 'dark' ? 'light' : 'dark')}
              sx={(theme) => ({
                minWidth: 56,
                width: 56,
                height: 56,
                p: 0,
                borderRadius: '10px',
                backgroundImage: 'none',
                backgroundColor: theme.palette.mode === 'dark' ? '#23262b' : alpha('#ece4d7', 0.88),
                color: 'text.primary',
              })}>
              <Icon
                icon={themeMode === 'dark' ? 'solar:sun-2-bold-duotone' : 'solar:moon-stars-bold-duotone'}
                width={24}
              />
            </Button>
          </Stack>

          <TextField
            autoFocus
            value={code}
            onChange={(event) => {
              setErrorMessage('');
              setCode(event.target.value.slice(0, 6));
            }}
            placeholder="A1B2C3"
            inputProps={{ maxLength: 6 }}
          />

          <Button
            variant="contained"
            disabled={code.trim().length !== 6 || loginMutation.isPending}
            onClick={() => loginMutation.mutate({ code: code.trim() })}>
            {loginMutation.isPending ? copy.signingIn : copy.enter}
          </Button>

          <Button variant="text" onClick={() => navigate('/edge-pairing')}>
            Kassani lokal coordinatorga ulash
          </Button>

          <Stack direction="row" spacing={1}>
            {(['uz', 'uz-crl', 'ru'] as const).map((currentLocale) => (
              <Button
                key={currentLocale}
                variant="contained"
                onClick={() => setLocale(currentLocale)}
                sx={(theme) => ({
                  minWidth: 68,
                  backgroundImage: 'none',
                  backgroundColor:
                    locale === currentLocale
                      ? theme.palette.primary.main
                      : theme.palette.mode === 'dark'
                        ? '#25272b'
                        : alpha('#ece4d7', 0.9),
                })}>
                {localeLabels[currentLocale]}
              </Button>
            ))}
          </Stack>

          {errorMessage ? (
            <Typography color="error.main" sx={{ fontWeight: 700 }}>
              {errorMessage}
            </Typography>
          ) : null}
        </Stack>
      </Box>
    </Box>
  );
}
