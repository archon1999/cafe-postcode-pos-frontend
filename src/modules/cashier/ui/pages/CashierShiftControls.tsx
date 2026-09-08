import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Typography,
  alpha,
} from '@mui/material';
import { useState } from 'react';

import type { CashierContextCashDesk, CashierContextCashier, CashShiftSummary } from 'modules/cashier/domain';
import { isValidOpeningCash } from 'modules/cashier/domain';
import { getSaleUnit, saleUnitLabel } from 'shared/domain/sale-units';
import { getPosCopy, type PosLocale } from 'shared/locale/copy';
import { formatCompactMoney, formatDateTime } from 'shared/pos/utils';

type ShiftTotalsProps = {
  locale: PosLocale;
  shift: CashShiftSummary;
};

export function CashierShiftSoldItems({ locale, shift }: ShiftTotalsProps) {
  const copy = getPosCopy(locale);

  return (
    <Stack spacing={1.1}>
      <Typography variant="subtitle2">{copy.shiftSoldItems}</Typography>
      {(shift.soldItems ?? []).map((item) => (
        <Stack
          key={`${item.catalogItemId}-${item.saleUnit}`}
          direction="row"
          justifyContent="space-between"
          spacing={2}>
          <Typography sx={{ overflowWrap: 'anywhere' }}>{item.name}</Typography>
          <Typography sx={{ flexShrink: 0 }}>
            {Number(item.quantity)}{' '}
            {getSaleUnit(item.saleUnit).quantityInput ? saleUnitLabel(item.saleUnit, locale) : copy.pieceUnit} ·{' '}
            {formatCompactMoney(item.revenue, locale)}
          </Typography>
        </Stack>
      ))}
      {!shift.soldItems?.length && <Typography color="text.secondary">{copy.noShiftSoldItems}</Typography>}
    </Stack>
  );
}

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
      <CashierShiftSoldItems locale={locale} shift={shift} />
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
  onClose: (includeSoldItems: boolean) => void;
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
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [includeSoldItems, setIncludeSoldItems] = useState(false);
  const closeStatus =
    shift.closeState === 'fiscal_unknown'
      ? copy.shiftCloseUnknown
      : shift.closeState === 'closed_local' ||
          shift.status === 'closed_local' ||
          shift.status === 'closed-local' ||
          (shift.status === 'closed' && shift.syncState === 'pending')
        ? copy.shiftClosedLocal
        : shift.status === 'closing' || shift.closeState === 'draining' || shift.closeState === 'fiscal_closing'
          ? copy.shiftClosing
          : shift.status === 'closed'
            ? copy.shiftSyncComplete
            : '';

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
        {closeStatus ? (
          <Typography color={shift.closeState === 'fiscal_unknown' ? 'error.main' : 'warning.main'}>
            {closeStatus}
          </Typography>
        ) : null}
        {shift.closeBlockers?.map((blocker) => (
          <Typography key={blocker.code} color="error.main">
            {blocker.detail}
          </Typography>
        ))}
        <CashierShiftTotals locale={locale} shift={shift} />
        <Button variant="contained" color="success" onClick={() => void onPrint()}>
          {printing ? copy.processing : copy.printShiftReport}
        </Button>
        {closesFiscalShift ? (
          <Typography variant="body2" color="text.secondary">
            {copy.closeFiscalWithShift}
          </Typography>
        ) : null}
        <Button
          variant="contained"
          color="error"
          disabled={
            closing || shift.status === 'closed_local' || shift.status === 'closed-local' || shift.status === 'closed'
          }
          onClick={() => {
            if (shift.status === 'closing' || shift.closeState === 'fiscal_unknown') {
              onClose(false);
              return;
            }
            setIncludeSoldItems(false);
            setCloseDialogOpen(true);
          }}>
          {closing
            ? copy.processing
            : shift.status === 'closing' || shift.closeState === 'fiscal_unknown'
              ? copy.checkFinancialResult
              : copy.closeShift}
        </Button>
      </Stack>
      <Dialog open={closeDialogOpen} onClose={() => setCloseDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>{copy.closeShift}</DialogTitle>
        <DialogContent>
          <FormControlLabel
            label={copy.includeSoldItems}
            control={
              <Checkbox checked={includeSoldItems} onChange={(event) => setIncludeSoldItems(event.target.checked)} />
            }
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCloseDialogOpen(false)}>{copy.back}</Button>
          <Button
            color="error"
            variant="contained"
            disabled={closing}
            onClick={() => {
              setCloseDialogOpen(false);
              onClose(includeSoldItems);
            }}>
            {copy.closeShift}
          </Button>
        </DialogActions>
      </Dialog>
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
        error={!isValidOpeningCash(openingCash)}
        helperText={!isValidOpeningCash(openingCash) ? copy.invalidOpeningCash : undefined}
        slotProps={{ htmlInput: { min: 0, max: 2_147_483_647, step: 1 } }}
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
