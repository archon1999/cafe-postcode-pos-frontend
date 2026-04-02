import {
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  Snackbar,
  Stack,
  TextField,
  Typography,
  alpha,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';

import { canManageCashierPayments, isCashierBuilderMode, usePosSession } from 'modules/auth';
import {
  useCashierContextQuery,
  useCashierPaymentMutation,
  useCashierPaymentOrderQuery,
} from 'modules/cashier/application';
import type { CashierPaymentResponse, PaymentMethod } from 'modules/cashier/domain';
import { PosPageFrame } from 'shared/layout/PosPageFrame';
import { getPosCopy } from 'shared/locale/copy';
import { formatCompactMoney, formatTime } from 'shared/pos/utils';
import { PosIconAction, PosOrderChannelSegment, PosSettingsMenu } from 'shared/ui/pos-primitives';

export type PaymentPageContentProps = {
  orderId?: string | null;
};

export function PaymentPageContent({ orderId }: PaymentPageContentProps) {
  const navigate = useNavigate();
  const { session, locale, setLocale, setSession, themeMode, setThemeMode } = usePosSession();
  const copy = getPosCopy(locale);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [settingsAnchor, setSettingsAnchor] = useState<HTMLElement | null>(null);
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [amount, setAmount] = useState('0');
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [qrCountdown, setQrCountdown] = useState(5);
  const [receiptData, setReceiptData] = useState<CashierPaymentResponse | null>(null);
  const [paymentErrorToastOpen, setPaymentErrorToastOpen] = useState(false);
  const [printToastOpen, setPrintToastOpen] = useState(false);
  const canProcessPayments = canManageCashierPayments(session?.user, session?.featureConfig ?? null);

  const cashierContextQuery = useCashierContextQuery({
    enabled: Boolean(session?.token) && canProcessPayments,
    refetchInterval: canProcessPayments ? 15000 : false,
  });
  const orderQuery = useCashierPaymentOrderQuery(orderId);
  const paymentMutation = useCashierPaymentMutation({
    orderId,
    onSuccess: () => setQrDialogOpen(false),
  });
  const selectedCashDesk = cashierContextQuery.data?.availableCashDesks[0] ?? null;

  const remainingTotal = useMemo(() => {
    const total = Number(orderQuery.data?.total ?? 0);
    const paidTotal = (orderQuery.data?.payments ?? [])
      .filter((payment) => payment.status === 'succeeded')
      .reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);

    return Math.max(total - paidTotal, 0);
  }, [orderQuery.data?.payments, orderQuery.data?.total]);

  useEffect(() => {
    if (remainingTotal > 0) {
      setAmount(String(remainingTotal));
    }
  }, [remainingTotal]);

  useEffect(() => {
    if (paymentMutation.isError) {
      setPaymentErrorToastOpen(true);
    }
  }, [paymentMutation.isError]);

  useEffect(() => {
    if (!qrDialogOpen || method !== 'qr' || paymentMutation.isPending || paymentMutation.isSuccess) {
      return;
    }

    setQrCountdown(5);
    const intervalId = window.setInterval(() => {
      setQrCountdown((currentValue) => (currentValue > 0 ? currentValue - 1 : 0));
    }, 1000);
    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await paymentMutation.mutateAsync({ method: 'qr', amount: Number(amount || 0) });
        setReceiptData(response);
      } catch {
        // Error toast is handled via mutation state.
      }
    }, 5000);

    return () => {
      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
    };
  }, [amount, method, paymentMutation, qrDialogOpen]);

  const paymentOptions = useMemo(
    () =>
      (selectedCashDesk?.enabledPaymentMethods ?? ['cash', 'card', 'qr']).map((value) => ({
        value,
        label: value === 'cash' ? copy.cash : value === 'card' ? copy.card : copy.qr,
      })),
    [copy.card, copy.cash, copy.qr, selectedCashDesk?.enabledPaymentMethods],
  );

  const afterPaymentPath = isCashierBuilderMode(session?.featureConfig ?? null)
    ? '/cashier/builder'
    : '/cashier/open-checks';
  const canSubmitPayment = Boolean(orderId && canProcessPayments && Number(amount || 0) > 0 && !paymentMutation.isPending);
  const serviceFeePercent = Number(
    orderQuery.data?.serviceFeePercent ?? (orderQuery.data?.channel === 'hall' ? 10 : 0),
  );
  const serviceFeeLabel = `${copy.serviceFee} (${serviceFeePercent}%)`;

  const handlePayment = async () => {
    if (method === 'qr') {
      setQrDialogOpen(true);
      return;
    }

    try {
      const response = await paymentMutation.mutateAsync({ method, amount: Number(amount || 0) });
      setReceiptData(response);
    } catch {
      // Error toast is handled via mutation state.
    }
  };

  return (
    <PosPageFrame
      header={
        <Stack
          direction="row"
          spacing={{ xs: 1, md: 1.5 }}
          justifyContent="space-between"
          alignItems={{ xs: 'stretch', md: 'center' }}>
          <Stack direction="row" spacing={{ xs: 1, md: 1.5 }}>
            <PosIconAction icon="solar:alt-arrow-left-bold" onClick={() => navigate(afterPaymentPath)} />
            <Typography variant="h4" sx={{ alignSelf: 'center' }}>
              {copy.pay}
            </Typography>
          </Stack>

          <Stack
            direction="row"
            spacing={{ xs: 1, md: 1.5 }}
            sx={{ justifyContent: { xs: 'flex-end', md: 'flex-start' } }}>
            {!isMobile ? (
              <PosIconAction icon="solar:refresh-bold-duotone" onClick={() => window.location.reload()} />
            ) : null}
            <PosIconAction
              icon="solar:settings-bold-duotone"
              onClick={(event) => setSettingsAnchor(event.currentTarget)}
            />
            {!isMobile ? (
              <PosIconAction icon="solar:lock-password-bold-duotone" onClick={() => navigate('/lock-screen')} />
            ) : null}
          </Stack>
        </Stack>
      }>
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 360px' },
          gap: { xs: 2, md: 2.5 },
          alignContent: 'start',
          pb: 0.4,
        }}>
        <Box
          sx={(theme) => ({
            borderRadius: '14px',
            backgroundColor: theme.palette.mode === 'dark' ? '#1f2125' : '#f8f1e8',
            p: { xs: 1.8, md: 2.4 },
            border: `1px solid ${alpha('#ffffff', theme.palette.mode === 'dark' ? 0.04 : 0.28)}`,
          })}>
          <Stack spacing={2}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box
                sx={(theme) => ({
                  minWidth: { xs: 56, md: 62 },
                  height: { xs: 56, md: 62 },
                  borderRadius: '10px',
                  backgroundColor: theme.palette.mode === 'dark' ? '#474c54' : '#dad2c4',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 28,
                  fontWeight: 700,
                })}>
                {orderQuery.data?.channel === 'takeaway'
                  ? 'TG'
                  : (orderQuery.data?.tableName?.match(/\d+/)?.[0] ?? '0')}
              </Box>
              <Stack spacing={0.25}>
                <Typography variant="body1" color="text.secondary">
                  {copy.orders}: A{String(orderQuery.data?.orderNumber ?? 0).padStart(5, '0')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {orderQuery.data?.channel === 'takeaway'
                    ? copy.takeawayLabel
                    : (orderQuery.data?.hallName ?? copy.hallLabel)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {orderQuery.data?.openedByName}
                </Typography>
              </Stack>
            </Stack>

            <PosOrderChannelSegment
              hallLabel={copy.hall}
              takeawayLabel={copy.takeaway}
              channel={orderQuery.data?.channel}
            />

            <Stack spacing={1.15}>
              {(orderQuery.data?.items ?? []).map((item) => (
                <Box
                  key={item.id}
                  sx={(theme) => ({
                    borderRadius: '10px',
                    overflow: 'hidden',
                    backgroundColor: theme.palette.mode === 'dark' ? '#2c2f34' : '#ede4d7',
                  })}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 1.65 }}>
                    <Stack spacing={0.35}>
                      <Typography
                        variant="subtitle1"
                        sx={{
                          textDecoration: item.status === 'cancelled' ? 'line-through' : 'none',
                          opacity: item.status === 'cancelled' ? 0.72 : 1,
                        }}>
                        {item.catalogItemName} (x{item.quantity})
                      </Typography>
                      {item.status === 'cancelled' ? (
                        <Typography variant="caption" sx={{ color: 'error.main', fontWeight: 700 }}>
                          {copy.cancelled}
                        </Typography>
                      ) : null}
                    </Stack>
                    <Typography
                      variant="subtitle1"
                      sx={{
                        textDecoration: item.status === 'cancelled' ? 'line-through' : 'none',
                        opacity: item.status === 'cancelled' ? 0.72 : 1,
                      }}>
                      {formatCompactMoney(item.lineTotal, locale)}
                    </Typography>
                  </Stack>
                </Box>
              ))}
            </Stack>
          </Stack>
        </Box>

        <Box
          sx={(theme) => ({
            borderRadius: '14px',
            backgroundColor: theme.palette.mode === 'dark' ? '#1f2125' : '#f8f1e8',
            p: { xs: 1.8, md: 2.4 },
            border: `1px solid ${alpha('#ffffff', theme.palette.mode === 'dark' ? 0.04 : 0.28)}`,
          })}>
          <Stack spacing={2.2}>
            <Typography variant="h5">{copy.paymentMethod}</Typography>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} useFlexGap flexWrap="wrap">
              {paymentOptions.map((option) => (
                <Button
                  key={option.value}
                  variant="contained"
                  onClick={() => setMethod(option.value)}
                  sx={(theme) => ({
                    flex: 1,
                    minWidth: { xs: '100%', sm: 120 },
                    backgroundImage: 'none',
                    backgroundColor:
                      method === option.value
                        ? theme.palette.primary.main
                        : theme.palette.mode === 'dark'
                          ? '#2c2f34'
                          : '#ece4d7',
                    color: method === option.value ? '#ffffff' : 'text.primary',
                  })}>
                  {option.label}
                </Button>
              ))}
            </Stack>

            <TextField label={copy.total} value={amount} onChange={(event) => setAmount(event.target.value)} />

            <Stack spacing={1}>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body1" color="text.secondary">
                  {copy.subtotal}:
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  {formatCompactMoney(orderQuery.data?.subtotal, locale)}
                </Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body1" color="text.secondary">
                  {serviceFeeLabel}:
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  {formatCompactMoney(orderQuery.data?.serviceFee, locale)}
                </Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="h5">{copy.grandTotal}:</Typography>
                <Typography variant="h4">{formatCompactMoney(orderQuery.data?.total, locale)}</Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body1" color="text.secondary">
                  {copy.pay}:
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  {formatCompactMoney(remainingTotal, locale)}
                </Typography>
              </Stack>
              {selectedCashDesk ? (
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body1" color="text.secondary">
                    {copy.cashDesk}:
                  </Typography>
                  <Typography variant="body1" color="text.secondary">
                    {selectedCashDesk.name}
                  </Typography>
                </Stack>
              ) : null}
            </Stack>

            <Button variant="contained" size="large" fullWidth disabled={!canSubmitPayment} onClick={handlePayment}>
              {paymentMutation.isPending ? copy.processing : copy.completePayment}
            </Button>
          </Stack>
        </Box>
      </Box>

      <Dialog open={qrDialogOpen} onClose={() => setQrDialogOpen(false)} maxWidth="xs" fullWidth fullScreen={isMobile}>
        <DialogTitle>{copy.qrTitle}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.2} sx={{ pt: 1 }}>
            <Typography variant="body1" color="text.secondary">
              {copy.qrSubtitle}
            </Typography>

            <Box
              sx={(theme) => ({
                width: 220,
                height: 220,
                mx: 'auto',
                borderRadius: '18px',
                backgroundColor: theme.palette.mode === 'dark' ? '#0f1012' : '#ffffff',
                border: `10px solid ${theme.palette.mode === 'dark' ? '#f6f8fb' : '#111216'}`,
                backgroundImage:
                  'linear-gradient(90deg, rgba(0,0,0,0.92) 12%, transparent 12%, transparent 20%, rgba(0,0,0,0.92) 20%, rgba(0,0,0,0.92) 32%, transparent 32%, transparent 40%, rgba(0,0,0,0.92) 40%, rgba(0,0,0,0.92) 48%, transparent 48%, transparent 56%, rgba(0,0,0,0.92) 56%, rgba(0,0,0,0.92) 68%, transparent 68%, transparent 76%, rgba(0,0,0,0.92) 76%), linear-gradient(rgba(0,0,0,0.92) 12%, transparent 12%, transparent 20%, rgba(0,0,0,0.92) 20%, rgba(0,0,0,0.92) 32%, transparent 32%, transparent 40%, rgba(0,0,0,0.92) 40%, rgba(0,0,0,0.92) 48%, transparent 48%, transparent 56%, rgba(0,0,0,0.92) 56%, rgba(0,0,0,0.92) 68%, transparent 68%, transparent 76%, rgba(0,0,0,0.92) 76%)',
                backgroundSize: '40px 40px',
                position: 'relative',
                overflow: 'hidden',
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  insetInline: 14,
                  top: `${((5 - qrCountdown) / 5) * 180}px`,
                  height: 6,
                  borderRadius: 999,
                  backgroundColor: '#24c5bf',
                  boxShadow: '0 0 18px rgba(36, 197, 191, 0.8)',
                },
              })}
            />

            <Box
              sx={(theme) => ({
                height: 8,
                borderRadius: 999,
                backgroundColor: theme.palette.mode === 'dark' ? '#2a2d31' : '#e4daca',
                overflow: 'hidden',
              })}>
              <Box
                sx={(theme) => ({
                  width: `${((5 - qrCountdown) / 5) * 100}%`,
                  height: '100%',
                  backgroundColor: theme.palette.primary.main,
                })}
              />
            </Box>

            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="body2" color="text.secondary">
                {copy.qrCountdown}
              </Typography>
              <Typography variant="h6">{qrCountdown}s</Typography>
            </Stack>

            <Button
              variant="contained"
              onClick={() => setQrDialogOpen(false)}
              sx={(theme) => ({
                backgroundImage: 'none',
                backgroundColor: theme.palette.mode === 'dark' ? '#4d535a' : '#d8cfbf',
                color: theme.palette.mode === 'dark' ? '#f5f5f5' : theme.palette.text.primary,
              })}>
              {copy.cancelQr}
            </Button>
          </Stack>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(receiptData)}
        onClose={() => setReceiptData(null)}
        maxWidth="xs"
        fullWidth
        fullScreen={isMobile}>
        <DialogTitle>{copy.receiptTitle}</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ pt: 1 }}>
            <Stack direction="row" justifyContent="space-between">
              <Typography color="text.secondary">{copy.receiptNumber}</Typography>
              <Typography>
                {receiptData?.receipt?.payload?.receiptNumber ??
                  receiptData?.receipt?.payload?.receipt_number ??
                  receiptData?.payment.externalRef ??
                  '-'}
              </Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between">
              <Typography color="text.secondary">{copy.receiptMethod}</Typography>
              <Typography>
                {receiptData?.payment.method === 'card'
                  ? copy.card
                  : receiptData?.payment.method === 'qr'
                    ? copy.qr
                    : copy.cash}
              </Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between">
              <Typography color="text.secondary">{copy.receiptAmount}</Typography>
              <Typography>{formatCompactMoney(receiptData?.payment.amount, locale)}</Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between">
              <Typography color="text.secondary">{copy.receiptTime}</Typography>
              <Typography>
                {formatTime(
                  receiptData?.receipt?.payload?.issuedAt ??
                    receiptData?.receipt?.payload?.issued_at ??
                    receiptData?.payment.paidAt,
                  locale,
                )}
              </Typography>
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} sx={{ pt: 1 }}>
              <Button
                variant="contained"
                sx={(theme) => ({
                  flex: 1,
                  backgroundImage: 'none',
                  backgroundColor: theme.palette.mode === 'dark' ? '#4d535a' : '#d8cfbf',
                  color: theme.palette.mode === 'dark' ? '#f5f5f5' : theme.palette.text.primary,
                })}
                onClick={() => {
                  setPrintToastOpen(true);
                }}>
                {copy.printReceipt}
              </Button>
              <Button
                variant="contained"
                sx={{ flex: 1 }}
                onClick={() => {
                  setReceiptData(null);
                  navigate(afterPaymentPath, { replace: true });
                }}>
                {copy.finishReceipt}
              </Button>
            </Stack>
          </Stack>
        </DialogContent>
      </Dialog>

      <Snackbar
        open={paymentErrorToastOpen}
        autoHideDuration={2600}
        onClose={() => setPaymentErrorToastOpen(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Box
          sx={(theme) => ({
            px: 2,
            py: 1.2,
            borderRadius: '12px',
            backgroundColor: theme.palette.mode === 'dark' ? '#4c2529' : '#f6dadd',
            color: theme.palette.mode === 'dark' ? '#ffe9eb' : '#8a1f2d',
            fontWeight: 700,
            boxShadow: '0 12px 28px rgba(0, 0, 0, 0.22)',
          })}>
          {copy.paymentFailed}
        </Box>
      </Snackbar>

      <Snackbar
        open={printToastOpen}
        autoHideDuration={2200}
        onClose={() => setPrintToastOpen(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Box
          sx={(theme) => ({
            px: 2,
            py: 1.2,
            borderRadius: '12px',
            backgroundColor: theme.palette.mode === 'dark' ? '#1f4a46' : '#d8efea',
            color: theme.palette.mode === 'dark' ? '#d7fbf7' : '#155b54',
            fontWeight: 700,
            boxShadow: '0 12px 28px rgba(0, 0, 0, 0.22)',
          })}>
          {copy.receiptPrinted}
        </Box>
      </Snackbar>

      <PosSettingsMenu
        anchorEl={settingsAnchor}
        locale={locale}
        onClose={() => setSettingsAnchor(null)}
        onLocaleChange={setLocale}
        onRefresh={isMobile ? () => window.location.reload() : undefined}
        onLock={isMobile ? () => navigate('/lock-screen') : undefined}
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
