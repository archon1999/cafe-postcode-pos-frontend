import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

import {
  getCashierOrderDisplayName,
  type CashierPaymentResponse,
  type PaymentFailureState,
  type PaymentMethod,
} from 'modules/cashier/domain';
import { getPosCopy, type PosLocale } from 'shared/locale/copy';
import { formatCompactMoney, formatTime } from 'shared/pos/utils';

type PaymentCopy = ReturnType<typeof getPosCopy>;

type CardFailureDialogProps = {
  copy: PaymentCopy;
  debugJson: string;
  failureMessage: string;
  fullScreen: boolean;
  isPaymentProcessing: boolean;
  failedMethod: PaymentMethod | null;
  failureState: PaymentFailureState | null;
  open: boolean;
  onClose: () => void;
  onCopyDebug: () => void;
  onManualComplete: () => void;
  onRetry: () => void;
};

export function CardFailureDialog({
  copy,
  debugJson,
  failureMessage,
  fullScreen,
  isPaymentProcessing,
  failedMethod,
  failureState,
  open,
  onClose,
  onCopyDebug,
  onManualComplete,
  onRetry,
}: CardFailureDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth fullScreen={fullScreen}>
      <DialogTitle>{failureState?.state === 'unknown' ? copy.financialResultUnknown : copy.paymentFailed}</DialogTitle>
      <DialogContent>
        <Stack spacing={1.4} sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {failureMessage || copy.paymentFailed}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {failureState?.state === 'unknown' ? copy.financialResultUnknownHint : copy.financialPaymentRetryHint}
          </Typography>
          {debugJson ? (
            <Stack spacing={1}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                <Typography variant="subtitle2">{copy.martaDebugTitle}</Typography>
                <Button size="small" variant="contained" onClick={onCopyDebug}>
                  {copy.copyJson}
                </Button>
              </Stack>
              <Box
                component="pre"
                sx={(theme) => ({
                  m: 0,
                  p: 1.2,
                  maxHeight: 260,
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  borderRadius: '8px',
                  fontSize: 12,
                  lineHeight: 1.45,
                  backgroundColor: 'var(--pos-debug-panel-bg)',
                  color: theme.palette.text.primary,
                })}>
                {debugJson}
              </Box>
            </Stack>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} disabled={isPaymentProcessing}>
          {copy.close}
        </Button>
        <Button variant="contained" onClick={onRetry} disabled={isPaymentProcessing}>
          {failureState?.state === 'unknown' ? copy.checkFinancialResult : copy.retryPayment}
        </Button>
        {failedMethod === 'card' && failureState?.manualConfirmationAllowed ? (
          <Button variant="contained" onClick={onManualComplete} disabled={isPaymentProcessing}>
            {copy.manualCard}
          </Button>
        ) : null}
      </DialogActions>
    </Dialog>
  );
}

type RenameOrderDialogProps = {
  copy: PaymentCopy;
  error: string;
  fullScreen: boolean;
  isSaving: boolean;
  open: boolean;
  orderNumber: number;
  orderNumberLabel: string;
  value: string;
  onCancel: () => void;
  onChange: (value: string) => void;
  onSave: () => void;
};

export function RenameOrderDialog({
  copy,
  error,
  fullScreen,
  isSaving,
  open,
  orderNumber,
  orderNumberLabel,
  value,
  onCancel,
  onChange,
  onSave,
}: RenameOrderDialogProps) {
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth fullScreen={fullScreen}>
      <DialogTitle>{copy.renameOrder}</DialogTitle>
      <DialogContent>
        <Stack spacing={1.4} sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {getCashierOrderDisplayName({ orderNumber, displayName: value })}
          </Typography>
          <TextField
            autoFocus
            label={copy.orderName}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={copy.orderNamePlaceholder}
            error={Boolean(error)}
            helperText={error || orderNumberLabel}
            inputProps={{ maxLength: 120 }}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button
          variant="contained"
          onClick={onCancel}
          sx={(theme) => ({
            backgroundImage: 'none',
            backgroundColor: 'var(--pos-secondary-action-bg)',
            color: theme.palette.mode === 'dark' ? '#f5f5f5' : theme.palette.text.primary,
          })}>
          {copy.cancel}
        </Button>
        <Button variant="contained" onClick={onSave} disabled={isSaving}>
          {copy.save}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

type ReceiptDialogsProps = {
  copy: PaymentCopy;
  fullScreen: boolean;
  isPrintConfirming: boolean;
  isFiscalRetrying: boolean;
  onRetryFiscal: () => void;
  locale: PosLocale;
  printPromptOpen: boolean;
  receiptData: CashierPaymentResponse | null;
  onCloseReceipt: () => void;
  onFinish: () => void;
  onPrint: () => void;
  onSetPrintPromptOpen: (open: boolean) => void;
};

export function ReceiptDialogs({
  copy,
  fullScreen,
  isPrintConfirming,
  isFiscalRetrying,
  onRetryFiscal,
  locale,
  printPromptOpen,
  receiptData,
  onCloseReceipt,
  onFinish,
  onPrint,
  onSetPrintPromptOpen,
}: ReceiptDialogsProps) {
  const receipts = receiptData?.receipts?.filter(Boolean) ?? (receiptData?.receipt ? [receiptData.receipt] : []);
  const primaryReceipt = receipts[0] ?? receiptData?.receipt ?? null;
  const receiptNumbers = receipts
    .map((receipt) => receipt?.payload?.receiptNumber)
    .filter(Boolean)
    .join(', ');
  const hasFiscalReceipt = receipts.some(
    (receipt) => receipt?.kind === 'fiscal' || receipt?.status === 'sent' || receipt?.fiscalState === 'registered',
  );
  const failedReceipt = receipts.find((receipt) => receipt?.status === 'failed');
  const fiscalReceiptError = failedReceipt ? copy.fiscalReceiptRetryHint : null;
  const fiscalUnknown = receipts.some(
    (receipt) =>
      receipt?.status === 'unknown' || receipt?.status === 'registering' || receipt?.fiscalState === 'unknown',
  );
  const hasPrintableReceipt =
    !fiscalUnknown && !failedReceipt && receipts.some((receipt) => Boolean(receipt?.printDocument));

  return (
    <>
      <Dialog
        open={Boolean(receiptData) && !printPromptOpen}
        onClose={onCloseReceipt}
        maxWidth="xs"
        fullWidth
        fullScreen={fullScreen}>
        <DialogTitle>
          {fiscalUnknown
            ? copy.fiscalReceiptUnknown
            : fiscalReceiptError
              ? copy.fiscalReceiptFailed
              : copy.receiptTitle}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ pt: 1 }}>
            {fiscalUnknown ? <Typography color="warning.main">{copy.financialResultUnknownHint}</Typography> : null}
            {fiscalReceiptError ? (
              <Typography color="error.main" sx={{ fontWeight: 700 }}>
                {fiscalReceiptError}
              </Typography>
            ) : null}
            <Stack direction="row" justifyContent="space-between">
              <Typography color="text.secondary">{copy.receiptNumber}</Typography>
              <Typography>
                {receiptNumbers ||
                  (hasFiscalReceipt
                    ? '-'
                    : receiptData?.order.displayName || `#${receiptData?.order.orderNumber ?? '-'}`)}
              </Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between">
              <Typography color="text.secondary">{copy.receiptMethod}</Typography>
              <Typography>
                {receiptData?.payment.method === 'card'
                  ? copy.card
                  : receiptData?.payment.method === 'mixed'
                    ? copy.mixed
                    : copy.cash}
              </Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between">
              <Typography color="text.secondary">{copy.receiptAmount}</Typography>
              <Typography>
                {formatCompactMoney(
                  receiptData?.order.status === 'closed' ? receiptData.order.total : receiptData?.payment.amount,
                  locale,
                )}
              </Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between">
              <Typography color="text.secondary">{copy.receiptTime}</Typography>
              <Typography>
                {formatTime(primaryReceipt?.payload?.issuedAt ?? receiptData?.payment.paidAt, locale)}
              </Typography>
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} sx={{ pt: 1 }}>
              {fiscalUnknown || failedReceipt ? (
                <Button variant="contained" disabled={isFiscalRetrying} onClick={onRetryFiscal}>
                  {isFiscalRetrying ? copy.processing : copy.checkFinancialResult}
                </Button>
              ) : null}
              <Button
                variant="contained"
                disabled={isFiscalRetrying}
                sx={{ flex: 1 }}
                onClick={() => (hasPrintableReceipt ? onSetPrintPromptOpen(true) : onFinish())}>
                {copy.finishReceipt}
              </Button>
            </Stack>
          </Stack>
        </DialogContent>
      </Dialog>

      <Dialog
        open={printPromptOpen && Boolean(receiptData)}
        onClose={() => {
          if (!isPrintConfirming) {
            onSetPrintPromptOpen(false);
          }
        }}
        maxWidth="xs"
        fullWidth
        fullScreen={fullScreen}>
        <DialogTitle>{copy.receiptPrintPromptTitle}</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary">{copy.receiptPrintPromptBody}</Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button
            variant="contained"
            disabled={isPrintConfirming}
            sx={(theme) => ({
              flex: 1,
              backgroundImage: 'none',
              backgroundColor: 'var(--pos-secondary-action-bg)',
              color: theme.palette.mode === 'dark' ? '#f5f5f5' : theme.palette.text.primary,
            })}
            onClick={onFinish}>
            {copy.receiptPrintNo}
          </Button>
          <Button variant="contained" sx={{ flex: 1 }} disabled={isPrintConfirming} onClick={onPrint}>
            {copy.receiptPrintYes}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
