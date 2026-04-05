import { Box, Button, MenuItem, Stack, TextField, Typography, alpha, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useMemo, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';

import { canAccessCashier, getPosHomePath, isCashierBuilderMode, usePosSession } from 'modules/auth';
import {
  useCashierContextQuery,
  useCloseCashierShiftMutation,
  useOpenCashierShiftMutation,
} from 'modules/cashier/application';
import { PosPageFrame } from 'shared/layout/PosPageFrame';
import { getPosCopy } from 'shared/locale/copy';
import { formatCompactMoney } from 'shared/pos/utils';
import { PosIconAction, PosSettingsMenu } from 'shared/ui/pos-primitives';

export function CashierShiftPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { session, locale, setLocale, setSession, themeMode, setThemeMode } = usePosSession();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const copy = getPosCopy(locale);

  const [settingsAnchor, setSettingsAnchor] = useState<HTMLElement | null>(null);
  const [selectedCashDeskId, setSelectedCashDeskId] = useState('');
  const [openingCash, setOpeningCash] = useState('0');
  const [openingNotes, setOpeningNotes] = useState('');
  const [actualCash, setActualCash] = useState('');
  const [closingNotes, setClosingNotes] = useState('');

  const hasCashierAccess = canAccessCashier(session?.user);
  const contextQuery = useCashierContextQuery({ enabled: hasCashierAccess, refetchInterval: 15000 });
  const nextPath =
    searchParams.get('next') || (isCashierBuilderMode(session?.user) ? '/cashier/builder' : '/cashier/open-checks');
  const currentShift = contextQuery.data?.currentShift ?? null;
  const availableCashDesks = contextQuery.data?.availableCashDesks ?? [];

  const openShiftMutation = useOpenCashierShiftMutation({
    onSuccess: () => {
      navigate(nextPath, { replace: true });
    },
  });
  const closeShiftMutation = useCloseCashierShiftMutation({
    onSuccess: () => {
      navigate('/lock-screen', { replace: true });
    },
  });

  const selectedCashDeskIdValue =
    selectedCashDeskId || (availableCashDesks.length === 1 ? (availableCashDesks[0]?.id ?? '') : '');
  const canOpenShift = Boolean(selectedCashDeskIdValue || availableCashDesks.length === 1);
  const expectedCloseCash = useMemo(
    () => Number(currentShift?.expectedClosingCashAmount ?? 0),
    [currentShift?.expectedClosingCashAmount],
  );
  const actualCloseCash = Number(actualCash || 0);
  const liveDifference = actualCash ? actualCloseCash - expectedCloseCash : 0;

  if (!hasCashierAccess) {
    return <Navigate to={getPosHomePath(session)} replace />;
  }

  return (
    <PosPageFrame
      header={
        <Stack direction="row" spacing={1.5} justifyContent="space-between" alignItems="center">
          <Stack direction="row" spacing={1.5} alignItems="center">
            <PosIconAction icon="solar:alt-arrow-left-bold" onClick={() => navigate(getPosHomePath(session))} />
            <Typography variant="h4">{copy.shift}</Typography>
          </Stack>

          <PosIconAction
            icon="solar:settings-bold-duotone"
            onClick={(event) => setSettingsAnchor(event.currentTarget)}
          />
        </Stack>
      }>
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          placeItems: 'center',
        }}>
        <Box
          sx={(theme) => ({
            width: '100%',
            maxWidth: 560,
            borderRadius: '18px',
            p: { xs: 2, md: 2.6 },
            backgroundColor: theme.palette.mode === 'dark' ? '#1f2125' : '#f8f1e8',
            border: `1px solid ${alpha('#ffffff', theme.palette.mode === 'dark' ? 0.05 : 0.32)}`,
            boxShadow:
              theme.palette.mode === 'dark' ? '0 20px 40px rgba(0,0,0,0.24)' : '0 18px 38px rgba(121,87,44,0.1)',
          })}>
          {contextQuery.isLoading && !contextQuery.data ? (
            <Typography variant="h6" color="text.secondary">
              {copy.processing}
            </Typography>
          ) : currentShift ? (
            <Stack spacing={2}>
              <Box>
                <Typography variant="h5">{copy.currentShift}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                  {currentShift.cashDeskName}
                </Typography>
              </Box>

              <Stack spacing={1}>
                <Stack direction="row" justifyContent="space-between">
                  <Typography color="text.secondary">{copy.openingCash}</Typography>
                  <Typography>{formatCompactMoney(currentShift.openingCashAmount, locale)}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography color="text.secondary">{copy.expectedCash}</Typography>
                  <Typography>{formatCompactMoney(expectedCloseCash, locale)}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography color="text.secondary">{copy.shiftCashTotal}</Typography>
                  <Typography>{formatCompactMoney(currentShift.cashTotal, locale)}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography color="text.secondary">{copy.shiftCardTotal}</Typography>
                  <Typography>{formatCompactMoney(currentShift.cardTotal, locale)}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography color="text.secondary">{copy.shiftQrTotal}</Typography>
                  <Typography>{formatCompactMoney(currentShift.qrTotal, locale)}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography color="text.secondary">{copy.shiftRefundTotal}</Typography>
                  <Typography>{formatCompactMoney(currentShift.refundTotal, locale)}</Typography>
                </Stack>
              </Stack>

              <TextField
                type="number"
                label={copy.actualCash}
                value={actualCash}
                onChange={(event) => setActualCash(event.target.value)}
              />
              <TextField
                label={copy.notes}
                value={closingNotes}
                onChange={(event) => setClosingNotes(event.target.value)}
                multiline
                minRows={2}
              />

              <Box
                sx={(theme) => ({
                  borderRadius: '14px',
                  px: 1.5,
                  py: 1.2,
                  backgroundColor:
                    liveDifference === 0
                      ? theme.palette.mode === 'dark'
                        ? '#263c31'
                        : '#dcefe2'
                      : theme.palette.mode === 'dark'
                        ? '#4b2d2f'
                        : '#f6dddd',
                })}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" color="text.secondary">
                    {copy.cashDifference}
                  </Typography>
                  <Typography variant="h6">{formatCompactMoney(liveDifference, locale)}</Typography>
                </Stack>
              </Box>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2}>
                <Button
                  variant="contained"
                  sx={(theme) => ({
                    flex: 1,
                    backgroundImage: 'none',
                    backgroundColor: theme.palette.mode === 'dark' ? '#4d535a' : '#d8cfbf',
                    color: theme.palette.mode === 'dark' ? '#f5f5f5' : theme.palette.text.primary,
                  })}
                  onClick={() => navigate(nextPath, { replace: true })}>
                  {copy.continueWork}
                </Button>
                <Button
                  variant="contained"
                  color="error"
                  sx={{ flex: 1 }}
                  disabled={!actualCash || closeShiftMutation.isPending}
                  onClick={() =>
                    closeShiftMutation.mutate({
                      actualClosingCashAmount: Number(actualCash || 0),
                      notesClose: closingNotes,
                    })
                  }>
                  {closeShiftMutation.isPending ? copy.processing : copy.closeShift}
                </Button>
              </Stack>
            </Stack>
          ) : (
            <Stack spacing={2}>
              <Box>
                <Typography variant="h5">{copy.openShift}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                  {copy.openShiftDescription}
                </Typography>
              </Box>

              <TextField
                select
                label={copy.cashDesk}
                value={selectedCashDeskIdValue}
                onChange={(event) => setSelectedCashDeskId(event.target.value)}
                disabled={availableCashDesks.length <= 1}>
                {availableCashDesks.map((cashDesk) => (
                  <MenuItem key={cashDesk.id} value={cashDesk.id}>
                    {cashDesk.name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                type="number"
                label={copy.openingCash}
                value={openingCash}
                onChange={(event) => setOpeningCash(event.target.value)}
              />
              <TextField
                label={copy.notes}
                value={openingNotes}
                onChange={(event) => setOpeningNotes(event.target.value)}
                multiline
                minRows={2}
              />
              <Button
                variant="contained"
                size={isMobile ? 'large' : 'medium'}
                disabled={!canOpenShift || openShiftMutation.isPending}
                onClick={() =>
                  openShiftMutation.mutate({
                    cashDeskId: selectedCashDeskIdValue || undefined,
                    openingCashAmount: Number(openingCash || 0),
                    notesOpen: openingNotes,
                  })
                }>
                {openShiftMutation.isPending ? copy.processing : copy.openShift}
              </Button>
            </Stack>
          )}
        </Box>
      </Box>

      <PosSettingsMenu
        anchorEl={settingsAnchor}
        locale={locale}
        onClose={() => setSettingsAnchor(null)}
        onLocaleChange={setLocale}
        onLock={() => navigate('/lock-screen')}
        onRefresh={() => void contextQuery.refetch()}
        onThemeToggle={() => setThemeMode(themeMode === 'dark' ? 'light' : 'dark')}
        onSignOut={() => {
          setSession(null);
          navigate('/pin-login', { replace: true });
        }}
        themeMode={themeMode}
      />
    </PosPageFrame>
  );
}
