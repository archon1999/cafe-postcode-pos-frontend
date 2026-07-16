import { Box, Button, Checkbox, FormControlLabel, MenuItem, Stack, TextField, Typography, alpha } from '@mui/material';

import type { CashierContextCashDesk, CashierContextCashier, CashShiftSummary } from 'modules/cashier/domain';
import { getPosCopy, type PosLocale } from 'shared/locale/copy';
import { formatCompactMoney } from 'shared/pos/utils';

type ShiftTotalsProps = {
  locale: PosLocale;
  shift: CashShiftSummary;
};

export function CashierShiftTotals({ locale, shift }: ShiftTotalsProps) {
  const copy = getPosCopy(locale);
  const totals = [
    [copy.openingCash, shift.openingCashAmount],
    [copy.expectedCash, Number(shift.expectedClosingCashAmount ?? 0)],
    [copy.shiftCashTotal, shift.cashTotal],
    [copy.shiftCardTotal, shift.cardTotal],
    [copy.shiftQrTotal, shift.qrTotal],
    [copy.shiftRefundTotal, shift.refundTotal],
  ] as const;

  return (
    <Stack spacing={1}>
      {totals.map(([label, value]) => (
        <Stack key={label} direction="row" justifyContent="space-between">
          <Typography color="text.secondary">{label}</Typography>
          <Typography>{formatCompactMoney(value, locale)}</Typography>
        </Stack>
      ))}
    </Stack>
  );
}

type ManagerShiftCardProps = {
  canCloseFiscalShift: boolean;
  closeFiscalShift: boolean;
  closing: boolean;
  closingNotes: string;
  locale: PosLocale;
  onClose: () => void;
  onCloseFiscalChange: (value: boolean) => void;
  onClosingNotesChange: (value: string) => void;
  onContinue: () => void;
  onPrint: () => Promise<void>;
  printing: boolean;
  shift: CashShiftSummary;
};

export function ManagerShiftCard({
  canCloseFiscalShift,
  closeFiscalShift,
  closing,
  closingNotes,
  locale,
  onClose,
  onCloseFiscalChange,
  onClosingNotesChange,
  onContinue,
  onPrint,
  printing,
  shift,
}: ManagerShiftCardProps) {
  const copy = getPosCopy(locale);

  return (
    <Box
      sx={(theme) => ({
        borderRadius: '14px',
        p: 1.5,
        border: `1px solid ${alpha(theme.palette.text.primary, 0.12)}`,
      })}>
      <Stack spacing={1.4}>
        <Box>
          <Typography variant="subtitle1">{shift.cashDeskName}</Typography>
          <Typography variant="body2" color="text.secondary">
            {shift.cashierName || copy.cashier}
          </Typography>
        </Box>
        <CashierShiftTotals locale={locale} shift={shift} />
        <Button
          variant="contained"
          sx={(theme) => ({
            backgroundImage: 'none',
            backgroundColor: 'var(--pos-secondary-action-bg)',
            color: theme.palette.mode === 'dark' ? '#f5f5f5' : theme.palette.text.primary,
          })}
          onClick={onContinue}>
          {copy.continueWork}
        </Button>
        <Button variant="contained" color="success" disabled={printing} onClick={() => void onPrint()}>
          {printing ? copy.processing : copy.printShiftReport}
        </Button>
        <TextField
          label={copy.notes}
          value={closingNotes}
          onChange={(event) => onClosingNotesChange(event.target.value)}
          multiline
          minRows={2}
        />
        {canCloseFiscalShift ? (
          <FormControlLabel
            control={
              <Checkbox checked={closeFiscalShift} onChange={(event) => onCloseFiscalChange(event.target.checked)} />
            }
            label="Fiscal smenani ham yopish"
          />
        ) : null}
        <Button variant="contained" color="error" disabled={closing} onClick={onClose}>
          {closing ? copy.processing : copy.closeShift}
        </Button>
      </Stack>
    </Box>
  );
}

type OpenShiftFieldsProps = {
  availableCashDesks: CashierContextCashDesk[];
  availableCashiers: CashierContextCashier[];
  locale: PosLocale;
  onCashDeskChange: (value: string) => void;
  onCashierChange: (value: string) => void;
  onOpeningCashChange: (value: string) => void;
  onOpeningNotesChange: (value: string) => void;
  openingCash: string;
  openingNotes: string;
  requiresCashierSelection: boolean;
  selectedCashDeskId: string;
  selectedCashierId: string;
};

export function OpenShiftFields({
  availableCashDesks,
  availableCashiers,
  locale,
  onCashDeskChange,
  onCashierChange,
  onOpeningCashChange,
  onOpeningNotesChange,
  openingCash,
  openingNotes,
  requiresCashierSelection,
  selectedCashDeskId,
  selectedCashierId,
}: OpenShiftFieldsProps) {
  const copy = getPosCopy(locale);

  return (
    <Stack spacing={2}>
      <TextField
        select
        label={copy.cashDesk}
        value={selectedCashDeskId}
        onChange={(event) => onCashDeskChange(event.target.value)}
        disabled={availableCashDesks.length <= 1}>
        {availableCashDesks.map((cashDesk) => (
          <MenuItem key={cashDesk.id} value={cashDesk.id}>
            {cashDesk.name}
          </MenuItem>
        ))}
      </TextField>
      {requiresCashierSelection ? (
        <TextField
          select
          label={copy.cashier}
          value={selectedCashierId}
          onChange={(event) => onCashierChange(event.target.value)}>
          {availableCashiers.map((cashier) => (
            <MenuItem key={cashier.id} value={cashier.id}>
              {cashier.fullName || cashier.username}
            </MenuItem>
          ))}
        </TextField>
      ) : null}
      <TextField
        type="number"
        label={copy.openingCash}
        value={openingCash}
        onChange={(event) => onOpeningCashChange(event.target.value)}
      />
      <TextField
        label={copy.notes}
        value={openingNotes}
        onChange={(event) => onOpeningNotesChange(event.target.value)}
        multiline
        minRows={2}
      />
    </Stack>
  );
}
