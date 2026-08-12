import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  Typography,
  alpha,
} from '@mui/material';

import type { CashierShiftCloseResponse } from 'modules/cashier/domain';
import { getPosCopy, type PosLocale } from 'shared/locale/copy';
import { formatCompactMoney } from 'shared/pos/utils';

type CashierShiftReportDialogProps = {
  fullScreen: boolean;
  locale: PosLocale;
  onClose: () => void;
  report: CashierShiftCloseResponse | null;
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const valueOf = (record: Record<string, unknown> | null | undefined, ...keys: string[]) => {
  if (!record) {
    return undefined;
  }
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) {
      return record[key];
    }
  }
  return undefined;
};

const numberOf = (record: Record<string, unknown> | null | undefined, ...keys: string[]) =>
  Number(valueOf(record, ...keys) ?? 0);

const stringOf = (record: Record<string, unknown> | null | undefined, ...keys: string[]) =>
  String(valueOf(record, ...keys) ?? '');

const reportMoney = (
  report: Record<string, unknown> | null,
  groupKey: string,
  camelGroupKey: string,
  side = 'Sale',
  divisor = 1,
) => {
  const group = asRecord(valueOf(report, groupKey, camelGroupKey));
  return numberOf(group, side, side.charAt(0).toLowerCase() + side.slice(1)) / divisor;
};

function ReportMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <Stack direction="row" justifyContent="space-between" spacing={2}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" textAlign="right">
        {value}
      </Typography>
    </Stack>
  );
}

const reportBoxSx = (theme: { palette: { text: { primary: string } } }) => ({
  borderRadius: 2,
  border: `1px solid ${alpha(theme.palette.text.primary, 0.12)}`,
  p: 1.5,
});

function PosReport({ locale, report }: { locale: PosLocale; report: Record<string, unknown> | null }) {
  if (!report) {
    return null;
  }
  const copy = getPosCopy(locale);
  return (
    <Box sx={reportBoxSx}>
      <Stack spacing={0.9}>
        <Typography variant="subtitle1">{copy.ownPosReport}</Typography>
        <ReportMetric
          label={copy.reportTerminalId}
          value={stringOf(report, 'TerminalID', 'terminalID', 'terminalId') || '-'}
        />
        <ReportMetric label={copy.reportShiftOpened} value={stringOf(report, 'OpenTime', 'openTime') || '-'} />
        <ReportMetric label={copy.reportShiftClosed} value={stringOf(report, 'CloseTime', 'closeTime') || '-'} />
        <Divider />
        <ReportMetric
          label={copy.reportOrderPayments}
          value={`${numberOf(report, 'OrdersCount', 'ordersCount')} / ${numberOf(report, 'PaymentsCount', 'paymentsCount', 'TotalSaleCount', 'totalSaleCount')}`}
        />
        <ReportMetric
          label={copy.reportCashPrecheck}
          value={formatCompactMoney(reportMoney(report, 'TotalCash', 'totalCash', 'Precheck'), locale)}
        />
        <ReportMetric
          label={copy.reportCashReceipt}
          value={formatCompactMoney(reportMoney(report, 'TotalCash', 'totalCash', 'Receipt'), locale)}
        />
        <ReportMetric
          label={copy.reportCardPrecheck}
          value={formatCompactMoney(reportMoney(report, 'TotalCard', 'totalCard', 'Precheck'), locale)}
        />
        <ReportMetric
          label={copy.reportCardReceipt}
          value={formatCompactMoney(reportMoney(report, 'TotalCard', 'totalCard', 'Receipt'), locale)}
        />
        <ReportMetric
          label={copy.reportQrTurnover}
          value={formatCompactMoney(reportMoney(report, 'TotalQR', 'totalQR'), locale)}
        />
        <ReportMetric
          label={copy.reportRefunded}
          value={formatCompactMoney(numberOf(report, 'TotalRefundAmount', 'totalRefundAmount'), locale)}
        />
        <ReportMetric
          label={copy.reportNetTotal}
          value={formatCompactMoney(
            numberOf(report, 'NetTotal', 'netTotal', 'TotalSaleAmount', 'totalSaleAmount'),
            locale,
          )}
        />
        <ReportMetric
          label={copy.reportFiscalReceipts}
          value={numberOf(report, 'FiscalReceiptCount', 'fiscalReceiptCount')}
        />
      </Stack>
    </Box>
  );
}

function ProviderReport({ locale, report }: { locale: PosLocale; report: Record<string, unknown> | null }) {
  if (!report) {
    return null;
  }
  const copy = getPosCopy(locale);
  return (
    <Box sx={reportBoxSx}>
      <Stack spacing={0.9}>
        <Typography variant="subtitle1">{copy.unikassaZReport}</Typography>
        <ReportMetric
          label={copy.reportTerminalId}
          value={stringOf(report, 'TerminalID', 'terminalID', 'terminalId') || '-'}
        />
        <ReportMetric label={copy.reportOpenedAt} value={stringOf(report, 'OpenTime', 'openTime') || '-'} />
        <ReportMetric label={copy.reportSales} value={numberOf(report, 'TotalSaleCount', 'totalSaleCount')} />
        <ReportMetric label={copy.reportRefunds} value={numberOf(report, 'TotalRefundCount', 'totalRefundCount')} />
        <ReportMetric
          label={copy.reportCash}
          value={formatCompactMoney(reportMoney(report, 'TotalCash', 'totalCash', 'Sale', 100), locale)}
        />
        <ReportMetric
          label={copy.reportCard}
          value={formatCompactMoney(reportMoney(report, 'TotalCard', 'totalCard', 'Sale', 100), locale)}
        />
        <ReportMetric
          label={copy.reportVat}
          value={formatCompactMoney(reportMoney(report, 'TotalVAT', 'totalVAT', 'Sale', 100), locale)}
        />
        <ReportMetric
          label={copy.reportFirstReceipt}
          value={stringOf(report, 'FirstReceiptSeq', 'firstReceiptSeq') || '-'}
        />
        <ReportMetric
          label={copy.reportLastReceipt}
          value={stringOf(report, 'LastReceiptSeq', 'lastReceiptSeq') || '-'}
        />
      </Stack>
    </Box>
  );
}

function FiscalMemoryReport({ locale, report }: { locale: PosLocale; report: Record<string, unknown> | null }) {
  if (!report) {
    return null;
  }
  const copy = getPosCopy(locale);
  return (
    <Box sx={reportBoxSx}>
      <Stack spacing={0.9}>
        <Typography variant="subtitle1">{copy.unikassaFiscalMemory}</Typography>
        <ReportMetric
          label={copy.reportTerminalId}
          value={stringOf(report, 'TerminalID', 'terminalID', 'terminalId') || '-'}
        />
        <ReportMetric
          label={copy.reportLastOperation}
          value={stringOf(report, 'LastOperationTime', 'lastOperationTime') || '-'}
        />
        <ReportMetric label={copy.reportZReports} value={numberOf(report, 'ZReportsCount', 'zReportsCount')} />
        <ReportMetric label={copy.reportReceipts} value={numberOf(report, 'ReceiptsCount', 'receiptsCount')} />
      </Stack>
    </Box>
  );
}

export function CashierShiftReportDialog({ fullScreen, locale, onClose, report }: CashierShiftReportDialogProps) {
  const copy = getPosCopy(locale);
  const fiscalShift = asRecord(report?.fiscalShift ?? report?.fiscal_shift);
  const reports = asRecord(valueOf(fiscalShift, 'reports', 'report')) ?? asRecord(report?.report);
  const posReport = asRecord(valueOf(reports, 'posReport', 'pos_report'));
  const result = asRecord(valueOf(fiscalShift, 'result'));
  const providerReport =
    asRecord(valueOf(fiscalShift, 'providerReport', 'provider_report')) ??
    asRecord(valueOf(result, 'providerReport', 'provider_report'));
  const zInfo = asRecord(valueOf(providerReport, 'zInfo', 'z_info'));
  const fiscalMemory = asRecord(valueOf(providerReport, 'fiscalMemory', 'fiscal_memory'));

  return (
    <Dialog open={Boolean(report)} onClose={onClose} fullWidth maxWidth="sm" fullScreen={fullScreen}>
      <DialogTitle>{copy.shiftReportTitle}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1.5}>
          <PosReport locale={locale} report={posReport} />
          <ProviderReport locale={locale} report={zInfo} />
          <FiscalMemoryReport locale={locale} report={fiscalMemory} />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button variant="contained" onClick={onClose}>
          {copy.close}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
