import { Box, Button, Divider, MenuItem, Stack, TextField, Typography, alpha } from '@mui/material';

import type { CashierContextCashDesk, CashierContextCashier, CashShiftSummary } from 'modules/cashier/domain';
import { getPosCopy, type PosLocale } from 'shared/locale/copy';
import { formatCompactMoney, formatDateTime } from 'shared/pos/utils';

type ShiftTotalsProps = {
  locale: PosLocale;
  shift: CashShiftSummary;
};

export function CashierShiftTotals({ locale, shift }: ShiftTotalsProps) {
  const copy = getPosCopy(locale);
  const saleTotal = Number(shift.totalSaleAmount ?? shift.cashTotal + shift.cardTotal + shift.qrTotal);
  const refundTotal = Number(shift.refundTotal ?? 0);
  const saleRows = [
    [copy.reportSales, Number(shift.saleCount ?? shift.receiptCount ?? 0), false],
    [copy.reportCashPrecheck, Number(shift.cashPrecheckTotal ?? 0), true],
    [copy.reportCashReceipt, Number(shift.cashReceiptTotal ?? 0), true],
    [copy.reportCardPrecheck, Number(shift.cardPrecheckTotal ?? 0), true],
    [copy.reportCardReceipt, Number(shift.cardReceiptTotal ?? 0), true],
    ...(Number(shift.qrTotal ?? 0) > 0 ? ([[copy.qr, Number(shift.qrTotal), true]] as const) : []),
    ...(Number(shift.vatSaleTotal ?? 0) > 0 ? ([[copy.reportVat, Number(shift.vatSaleTotal), true]] as const) : []),
    [copy.shiftReportTotal, saleTotal, true],
  ] as const;
  const refundRows = [
    [copy.reportRefunds, Number(shift.refundCount ?? 0), false],
    [copy.reportCash, Number(shift.cashRefundTotal ?? 0), true],
    [copy.reportCard, Number(shift.cardRefundTotal ?? 0), true],
    ...(Number(shift.qrRefundTotal ?? 0) > 0 ? ([[copy.qr, Number(shift.qrRefundTotal), true]] as const) : []),
    ...(Number(shift.vatRefundTotal ?? 0) > 0 ? ([[copy.reportVat, Number(shift.vatRefundTotal), true]] as const) : []),
    [copy.shiftReportTotal, refundTotal, true],
  ] as const;

  const renderRows = (rows: typeof saleRows | typeof refundRows) =>
    rows.map(([label, value, money], index) => (
      <Stack key={`${label}-${index}`} direction="row" justifyContent="space-between">
        <Typography color="text.secondary">{label}</Typography>
        <Typography fontWeight={index === rows.length - 1 ? 700 : undefined}>
          {money ? formatCompactMoney(value, locale) : value}
        </Typography>
      </Stack>
    ));

  return (
    <Stack spacing={1.1}>
      <Stack direction="row" justifyContent="space-between">
        <Typography color="text.secondary">{copy.reportShiftOpened}</Typography>
        <Typography>{formatDateTime(shift.openedAt, locale)}</Typography>
      </Stack>
      {shift.firstReceipt ? (
        <Stack direction="row" justifyContent="space-between">
          <Typography color="text.secondary">{copy.reportFirstReceipt}</Typography>
          <Typography>{shift.firstReceipt}</Typography>
        </Stack>
      ) : null}
      {shift.lastReceipt ? (
        <Stack direction="row" justifyContent="space-between">
          <Typography color="text.secondary">{copy.reportLastReceipt}</Typography>
          <Typography>{shift.lastReceipt}</Typography>
        </Stack>
      ) : null}
      <Divider />
      <Typography variant="subtitle2" textAlign="center">
        {copy.shiftSalesSection}
      </Typography>
      {renderRows(saleRows)}
      <Divider />
      <Typography variant="subtitle2" textAlign="center">
        {copy.shiftRefundSection}
      </Typography>
      {renderRows(refundRows)}
      <Divider />
      <Stack direction="row" justifyContent="space-between">
        <Typography color="text.secondary">{copy.expenses}</Typography>
        <Typography fontWeight={700}>{formatCompactMoney(Number(shift.expenseTotal ?? 0), locale)}</Typography>
      </Stack>
      <Stack direction="row" justifyContent="space-between">
        <Typography color="text.secondary">{copy.expectedCash}</Typography>
        <Typography fontWeight={700}>
          {formatCompactMoney(Number(shift.expectedClosingCashAmount ?? 0), locale)}
        </Typography>
      </Stack>
    </Stack>
  );
}

type ManagerShiftCardProps = {
  closesFiscalShift: boolean;
  closing: boolean;
  locale: PosLocale;
  onClose: () => void;
  onPrint: () => Promise<void>;
  printing: boolean;
  shift: CashShiftSummary;
};

export function ManagerShiftCard({
  closesFiscalShift,
  closing,
  locale,
  onClose,
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
        <Button variant="contained" color="success" onClick={() => void onPrint()}>
          {printing ? copy.processing : copy.printShiftReport}
        </Button>
        {closesFiscalShift ? (
          <Typography variant="body2" color="text.secondary">
            {copy.closeFiscalWithShift}
          </Typography>
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
