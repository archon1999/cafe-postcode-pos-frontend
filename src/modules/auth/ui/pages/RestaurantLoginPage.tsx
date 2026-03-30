import { useState } from 'react';

import { Box, Button, Stack, TextField, Typography, alpha } from '@mui/material';
import { useNavigate } from 'react-router';

import { getPosCopy } from 'shared/locale/copy';

import { useRestaurantCodeMutation } from '../../application';
import { usePosSession } from '../session-context';

export function RestaurantLoginPage() {
  const navigate = useNavigate();
  const { locale, setLocale, setRestaurantContext, themeMode, setThemeMode } = usePosSession();
  const copy = getPosCopy(locale);
  const [code, setCode] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const loginMutation = useRestaurantCodeMutation({
    onSuccess: (response) => {
      setErrorMessage('');
      setRestaurantContext(response);
      navigate('/pin-login', { replace: true });
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
        placeItems: 'center',
        px: 3,
        py: 4,
        backgroundColor: themeMode === 'dark' ? '#1b1d20' : '#f7f1e7',
      }}>
      <Stack spacing={3} sx={{ width: '100%', maxWidth: 420 }}>
        <Stack spacing={1}>
          <Typography variant="h3">{copy.signInTitle}</Typography>
          <Typography color="text.secondary">
            Restoran kodini kiriting. Kod tasdiqlangandan keyin PIN sahifasi ochiladi.
          </Typography>
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
              {currentLocale.toUpperCase()}
            </Button>
          ))}

          <Button
            variant="contained"
            onClick={() => setThemeMode(themeMode === 'dark' ? 'light' : 'dark')}
            sx={(theme) => ({
              ml: 'auto',
              backgroundImage: 'none',
              backgroundColor: theme.palette.mode === 'dark' ? '#25272b' : alpha('#ece4d7', 0.9),
            })}>
            {themeMode === 'dark' ? copy.lightMode : copy.darkMode}
          </Button>
        </Stack>

        {errorMessage ? (
          <Typography color="error.main" sx={{ fontWeight: 700 }}>
            {errorMessage}
          </Typography>
        ) : null}
      </Stack>
    </Box>
  );
}
