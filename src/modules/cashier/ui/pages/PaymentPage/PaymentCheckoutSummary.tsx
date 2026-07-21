import { Box, Button, Stack, Tooltip, Typography } from '@mui/material';

import { formatPosCopy, getPosCopy, type PosLocale } from 'shared/locale/copy';
import { formatCompactMoney } from 'shared/pos/utils';

type PaymentCheckoutSummaryProps = {
  canDisableFiscalRegistration: boolean;
  canSubmitPayment: boolean;
  copy: ReturnType<typeof getPosCopy>;
  currentShiftOpen: boolean;
  fiscalIntegrationReady: boolean;
  grandTotal: number | string | undefined;
  isPaymentProcessing: boolean;
  locale: PosLocale;
  markingCheckEnabled: boolean;
  markingMissingCount: number;
  onPay: (registerFiscal: boolean) => void;
  remainingTotal: number;
  selectedCashDeskName?: string;
  serviceFee: number | string | undefined;
  serviceFeeLabel: string;
  shouldShowServiceFee: boolean;
  shouldShowVat: boolean;
  subtotal: number | string | undefined;
  vatAmount: number;
  vatLabel: string;
};

export function PaymentCheckoutSummary({
  canDisableFiscalRegistration,
  canSubmitPayment,
  copy,
  currentShiftOpen,
  fiscalIntegrationReady,
  grandTotal,
  isPaymentProcessing,
  locale,
  markingCheckEnabled,
  markingMissingCount,
  onPay,
  remainingTotal,
  selectedCashDeskName,
  serviceFee,
  serviceFeeLabel,
  shouldShowServiceFee,
  shouldShowVat,
  subtotal,
  vatAmount,
  vatLabel,
}: PaymentCheckoutSummaryProps) {
  return (
    <>
      <Stack spacing={1}>
        <Stack direction="row" justifyContent="space-between">
          <Typography variant="body1" color="text.secondary">
            {copy.subtotal}:
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {formatCompactMoney(subtotal, locale)}
          </Typography>
        </Stack>
        {shouldShowServiceFee ? (
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="body1" color="text.secondary">
              {serviceFeeLabel}:
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {formatCompactMoney(serviceFee, locale)}
            </Typography>
          </Stack>
        ) : null}
        {shouldShowVat ? (
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="body1" color="text.secondary">
              {vatLabel}:
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {formatCompactMoney(vatAmount, locale)}
            </Typography>
          </Stack>
        ) : null}
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h5">{copy.grandTotal}:</Typography>
          <Typography variant="h4" sx={{ flex: 1, ml: 2, textAlign: 'right' }}>
            {formatCompactMoney(grandTotal, locale)}
          </Typography>
        </Stack>
        {remainingTotal > 0 && remainingTotal !== Number(grandTotal ?? 0) ? (
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="body1" color="text.secondary">
              {copy.pay}:
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {formatCompactMoney(remainingTotal, locale)}
            </Typography>
          </Stack>
        ) : null}
        {selectedCashDeskName ? (
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="body1" color="text.secondary">
              {copy.cashDesk}:
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {selectedCashDeskName}
            </Typography>
          </Stack>
        ) : null}
      </Stack>

      {markingCheckEnabled && markingMissingCount > 0 ? (
        <Typography variant="body2" color="warning.main">
          {formatPosCopy(copy.markingMissing, { count: markingMissingCount })}
        </Typography>
      ) : null}

      {!currentShiftOpen ? (
        <Typography variant="body2" color="error">
          {copy.openShiftBeforePayment}
        </Typography>
      ) : null}

      <Stack direction="row" spacing={1}>
        <Box component="span" sx={{ display: 'inline-flex', flex: '1 1 50%', minWidth: 0 }}>
          <Button
            variant="outlined"
            size="large"
            fullWidth
            disabled={!canSubmitPayment || !canDisableFiscalRegistration}
            onClick={() => onPay(false)}>
            {isPaymentProcessing ? copy.processing : copy.plainPayment}
          </Button>
        </Box>
        <Tooltip
          arrow
          title={
            fiscalIntegrationReady ? (
              <Typography variant="body2">
                {copy.fiscalPaymentHintPrefix}
                <Box component="strong" sx={{ fontWeight: 800 }}>
                  {copy.fiscalPaymentHintStrong}
                </Box>
                .
              </Typography>
            ) : (
              copy.fiscalIntegrationUnavailable
            )
          }>
          <Box component="span" sx={{ display: 'inline-flex', flex: '1 1 50%', minWidth: 0 }}>
            <Button
              variant="contained"
              size="large"
              fullWidth
              disabled={!canSubmitPayment || !fiscalIntegrationReady}
              onClick={() => onPay(true)}>
              {isPaymentProcessing ? copy.processing : copy.fiscalPayment}
            </Button>
          </Box>
        </Tooltip>
      </Stack>
    </>
  );
}
