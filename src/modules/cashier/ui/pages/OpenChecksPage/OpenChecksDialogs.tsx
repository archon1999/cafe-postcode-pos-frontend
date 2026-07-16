import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material';

import type { PosLocale, getPosCopy } from 'shared/locale/copy';
import { formatCompactMoney } from 'shared/pos/utils';

export type RetryFiscalReceipt = {
  id?: string;
  printDocument?: string | null;
  payload?: Record<string, unknown> | null;
};

export type RetryFiscalReceiptDialogState = {
  receipts: RetryFiscalReceipt[];
  receiptNumber: string;
  methodLabel: string;
  amount: number;
};

export function RetryFiscalReceiptDialogs({
  copy,
  dialog,
  fullScreen,
  isPrintConfirming,
  locale,
  printPromptOpen,
  onClose,
  onFinish,
  onPrint,
  onSetPrintPromptOpen,
}: {
  copy: ReturnType<typeof getPosCopy>;
  dialog: RetryFiscalReceiptDialogState | null;
  fullScreen: boolean;
  isPrintConfirming: boolean;
  locale: PosLocale;
  printPromptOpen: boolean;
  onClose: () => void;
  onFinish: () => void;
  onPrint: () => void;
  onSetPrintPromptOpen: (open: boolean) => void;
}) {
  return (
    <>
      <Dialog
        open={Boolean(dialog) && !printPromptOpen}
        onClose={onClose}
        maxWidth="xs"
        fullWidth
        fullScreen={fullScreen}>
        <DialogTitle>{copy.receiptTitle}</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ pt: 1 }}>
            <Stack direction="row" justifyContent="space-between">
              <Typography color="text.secondary">{copy.receiptNumber}</Typography>
              <Typography>{dialog?.receiptNumber ?? '-'}</Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between">
              <Typography color="text.secondary">{copy.receiptMethod}</Typography>
              <Typography>{dialog?.methodLabel ?? '-'}</Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between">
              <Typography color="text.secondary">{copy.receiptAmount}</Typography>
              <Typography>{formatCompactMoney(dialog?.amount ?? 0, locale)}</Typography>
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} sx={{ pt: 1 }}>
              <Button variant="contained" sx={{ flex: 1 }} onClick={() => onSetPrintPromptOpen(true)}>
                {copy.finishReceipt}
              </Button>
            </Stack>
          </Stack>
        </DialogContent>
      </Dialog>

      <Dialog
        open={printPromptOpen && Boolean(dialog)}
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

export function RenameOpenCheckDialog({
  copy,
  error,
  fullScreen,
  helperText,
  isSaving,
  open,
  preview,
  value,
  onCancel,
  onChange,
  onSave,
}: {
  copy: ReturnType<typeof getPosCopy>;
  error: string;
  fullScreen: boolean;
  helperText: string;
  isSaving: boolean;
  open: boolean;
  preview: string;
  value: string;
  onCancel: () => void;
  onChange: (value: string) => void;
  onSave: () => void;
}) {
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth fullScreen={fullScreen}>
      <DialogTitle>{copy.renameOrder}</DialogTitle>
      <DialogContent>
        <Stack spacing={1.4} sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {preview}
          </Typography>
          <TextField
            autoFocus
            label={copy.orderName}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={copy.orderNamePlaceholder}
            error={Boolean(error)}
            helperText={error || helperText}
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
