import { Icon } from '@iconify/react';
import { Box, Button, Stack, Typography, alpha } from '@mui/material';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { ignoreMismatchedAgent } from 'shared/api/edgeConnection';
import { getPosCopy, localeLabels } from 'shared/locale/copy';
import { PosLogo } from 'shared/ui/PosLogo';

import { usePinLoginMutation } from '../../application';
import { getPosHomePath } from '../../domain';
import { resolvePosAuthBackgroundImage } from '../auth-background';
import { usePosSession } from '../session-context';

const keypad = ['1', '2', '3', 'backspace', '4', '5', '6', '', '7', '8', '9', '', '', '0', '', ''];
const PIN_LENGTH = 4;

export function LoginPageContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const { locale, restaurantContext, setLocale, setRestaurantContext, setSession, themeMode, setThemeMode } =
    usePosSession();
  const copy = getPosCopy(locale);
  const [pin, setPin] = useState('');
  const [toastOpen, setToastOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const authBackgroundImage = resolvePosAuthBackgroundImage(restaurantContext);

  if (restaurantContext?.restaurantId) {
    ignoreMismatchedAgent(restaurantContext.restaurantId);
  }

  const appendDigit = (digit: string) => {
    setToastOpen(false);
    setErrorMessage('');
    setPin((currentValue) => (currentValue.length < PIN_LENGTH ? `${currentValue}${digit}` : currentValue));
  };

  const removeDigit = () => {
    setToastOpen(false);
    setErrorMessage('');
    setPin((currentValue) => currentValue.slice(0, -1));
  };

  const loginMutation = usePinLoginMutation({
    onSuccess: (response) => {
      setToastOpen(false);
      setErrorMessage('');
      setSession(response);
      void navigate(getPosHomePath(response), { replace: true });
    },
    onError: (error) => {
      setPin('');
      setErrorMessage(error.message || copy.invalidPin);
      setToastOpen(true);
    },
  });

  const handleRestaurantSignOut = () => {
    if (loginMutation.isPending) {
      return;
    }

    setPin('');
    setToastOpen(false);
    setErrorMessage('');
    setSession(null);
    setRestaurantContext(null);
    void navigate(`/restaurant-login${location.search}`, { replace: true });
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (loginMutation.isPending) {
        return;
      }

      if (/^\d$/.test(event.key)) {
        appendDigit(event.key);
      }

      if (event.key === 'Backspace') {
        removeDigit();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [loginMutation.isPending]);

  useEffect(() => {
    if (pin.length === PIN_LENGTH && !loginMutation.isPending) {
      if (!restaurantContext) {
        void navigate('/restaurant-login', { replace: true });
        return;
      }
      loginMutation.mutate({ pin, restaurantId: restaurantContext.restaurantId });
    }
  }, [loginMutation, navigate, pin, restaurantContext]);

  useEffect(() => {
    if (!toastOpen) {
      return;
    }

    const timeoutId = window.setTimeout(() => setToastOpen(false), 2600);
    return () => window.clearTimeout(timeoutId);
  }, [toastOpen]);

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
        <Stack spacing={4} sx={{ width: '100%', maxWidth: 440 }}>
          <Stack direction="row" justifyContent="space-between" spacing={2}>
            <Stack spacing={0.75}>
              <PosLogo isSingle={false} sx={{ width: 178, height: 50, mb: 0.5 }} />
              <Typography
                variant="h3"
                sx={{
                  fontSize: { xs: 44, lg: 54 },
                  lineHeight: 1.02,
                  letterSpacing: '-0.04em',
                }}>
                {copy.signInTitle}
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 360, fontSize: 16, lineHeight: 1.5 }}>
                {restaurantContext
                  ? `${restaurantContext.restaurantName}. ${copy.signInSubtitle}`
                  : copy.signInSubtitle}
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

          <Stack direction="row" spacing={1.5} justifyContent="space-between">
            {Array.from({ length: PIN_LENGTH }).map((_, index) => {
              const filled = index < pin.length;
              const active = index === Math.min(pin.length, PIN_LENGTH - 1);

              return (
                <Box
                  key={index}
                  sx={(theme) => ({
                    flex: 1,
                    height: 64,
                    borderRadius: '12px',
                    border: `2px solid ${active ? theme.palette.primary.main : alpha('#ffffff', theme.palette.mode === 'dark' ? 0.08 : 0.22)}`,
                    backgroundColor: theme.palette.mode === 'dark' ? '#25272b' : alpha('#efe7db', 0.88),
                    display: 'grid',
                    placeItems: 'center',
                  })}>
                  <Box
                    sx={(theme) => ({
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      backgroundColor: filled
                        ? theme.palette.mode === 'dark'
                          ? '#f3f6fb'
                          : '#66717b'
                        : alpha('#ffffff', 0.18),
                    })}
                  />
                </Box>
              );
            })}
          </Stack>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
              gap: 1.5,
            }}>
            {keypad.map((key, index) => {
              if (!key) {
                return <Box key={`empty-${index}`} />;
              }

              const isBackspace = key === 'backspace';

              return (
                <Button
                  key={key + index}
                  variant="contained"
                  onClick={() => {
                    if (loginMutation.isPending) {
                      return;
                    }

                    if (isBackspace) {
                      removeDigit();
                      return;
                    }

                    appendDigit(key);
                  }}
                  sx={(theme) => ({
                    height: 112,
                    fontSize: 36,
                    fontWeight: 700,
                    backgroundImage: 'none',
                    borderRadius: '12px',
                    backgroundColor: theme.palette.mode === 'dark' ? '#25272b' : alpha('#ece4d7', 0.9),
                    color: 'text.primary',
                  })}>
                  {isBackspace ? <Icon icon="solar:backspace-bold" width={28} /> : key}
                </Button>
              );
            })}
          </Box>

          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.1}
            justifyContent="space-between"
            alignItems={{ xs: 'stretch', sm: 'center' }}>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
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

              <Button
                variant="contained"
                disabled={loginMutation.isPending}
                onClick={handleRestaurantSignOut}
                startIcon={<Icon icon="solar:logout-3-bold-duotone" width={18} />}
                sx={(theme) => ({
                  minWidth: 112,
                  backgroundImage: 'none',
                  backgroundColor: theme.palette.mode === 'dark' ? '#25272b' : alpha('#ece4d7', 0.9),
                  color: 'text.primary',
                })}>
                {copy.signOut}
              </Button>
            </Stack>

            {toastOpen ? (
              <Typography color="error.main" sx={{ fontWeight: 700 }}>
                {errorMessage || copy.invalidPin}
              </Typography>
            ) : null}
          </Stack>
        </Stack>
      </Box>
    </Box>
  );
}
