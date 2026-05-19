import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  MenuItem,
  Stack,
  TextField,
  Typography,
  alpha,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useMemo, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';

import {
  canAccessCashier,
  canManageCashShift,
  getPosHomePath,
  isCashierBuilderMode,
  usePosSession,
} from 'modules/auth';
import {
  useCashierContextQuery,
  useCloseCashierShiftMutation,
  useOpenCashierShiftMutation,
} from 'modules/cashier/application';
import type { CashierShiftCloseResponse, CashShiftSummary } from 'modules/cashier/domain';
import { getApiErrorMessage } from 'shared/api/errorMessage';
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
  const [selectedCashierId, setSelectedCashierId] = useState('');
  const [openingCash, setOpeningCash] = useState('0');
  const [openingNotes, setOpeningNotes] = useState('');
  const [openShiftDialogOpen, setOpenShiftDialogOpen] = useState(false);
  const [shiftCloseReport, setShiftCloseReport] = useState<CashierShiftCloseResponse | null>(null);
  const [closingNotesByShift, setClosingNotesByShift] = useState<Record<string, string>>({});
  const [closeFiscalByShift, setCloseFiscalByShift] = useState<Record<string, boolean>>({});

  const hasCashierAccess = canAccessCashier(session?.user);
  const canManageShift = canManageCashShift(session?.user);
  const contextQuery = useCashierContextQuery({ enabled: hasCashierAccess, refetchInterval: 15000 });
  const nextPath =
    searchParams.get('next') || (isCashierBuilderMode(session?.user) ? '/cashier/builder' : '/cashier/open-checks');
  const currentShift = contextQuery.data?.currentShift ?? null;
  const activeShifts = contextQuery.data?.activeShifts ?? [];
  const availableCashDesks = contextQuery.data?.availableCashDesks ?? [];
  const availableCashiers = contextQuery.data?.availableCashiers ?? [];
  const hasFiscalIntegration = availableCashDesks.some((cashDesk) => Boolean(cashDesk.fiscalProvider));
  const activeCashDeskIds = useMemo(() => new Set(activeShifts.map((shift) => shift.cashDesk)), [activeShifts]);
  const cashDesksAvailableToOpen = useMemo(
    () => availableCashDesks.filter((cashDesk) => !activeCashDeskIds.has(cashDesk.id)),
    [activeCashDeskIds, availableCashDesks],
  );

  const openShiftMutation = useOpenCashierShiftMutation({
    onSuccess: () => {
      setSelectedCashDeskId('');
      setSelectedCashierId('');
      setOpeningCash('0');
      setOpeningNotes('');
      setOpenShiftDialogOpen(false);
      if (!canManageShift) {
        navigate(nextPath, { replace: true });
      }
    },
  });
  const closeShiftMutation = useCloseCashierShiftMutation({
    onSuccess: (response) => {
      void contextQuery.refetch();
      if (response.report || response.fiscalShift || response.fiscal_shift) {
        setShiftCloseReport(response);
      }
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Smenani yopishda xatolik bor.'));
    },
  });

  const selectedCashDeskIdValue =
    selectedCashDeskId || (cashDesksAvailableToOpen.length === 1 ? (cashDesksAvailableToOpen[0]?.id ?? '') : '');
  const requiresCashierSelection = availableCashDesks.length > 1;
  const canOpenShift = Boolean(
    canManageShift &&
      selectedCashDeskIdValue &&
      (!requiresCashierSelection || selectedCashierId) &&
      !openShiftMutation.isPending,
  );

  if (!hasCashierAccess) {
    return <Navigate to={getPosHomePath(session)} replace />;
  }

  const updateClosingNotes = (shiftId: string, value: string) => {
    setClosingNotesByShift((prev) => ({ ...prev, [shiftId]: value }));
  };

  const updateCloseFiscal = (shiftId: string, value: boolean) => {
    setCloseFiscalByShift((prev) => ({ ...prev, [shiftId]: value }));
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

  const renderReportMetric = (label: string, value: string | number) => (
    <Stack direction="row" justifyContent="space-between" spacing={2}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" textAlign="right">
        {value}
      </Typography>
    </Stack>
  );

  const renderUnikassaLikeReport = (title: string, report: Record<string, unknown> | null) => {
    if (!report) {
      return null;
    }
    return (
      <Box
        sx={(theme) => ({
          borderRadius: 2,
          border: `1px solid ${alpha(theme.palette.text.primary, 0.12)}`,
          p: 1.5,
        })}>
        <Stack spacing={0.9}>
          <Typography variant="subtitle1">{title}</Typography>
          {renderReportMetric('Terminal ID', stringOf(report, 'TerminalID', 'terminalID', 'terminalId') || '-')}
          {renderReportMetric('Smena ochilgan', stringOf(report, 'OpenTime', 'openTime') || '-')}
          {renderReportMetric('Smena yopilgan', stringOf(report, 'CloseTime', 'closeTime') || '-')}
          <Divider />
          {renderReportMetric('Buyurtma / to‘lovlar', `${numberOf(report, 'OrdersCount', 'ordersCount')} / ${numberOf(report, 'PaymentsCount', 'paymentsCount', 'TotalSaleCount', 'totalSaleCount')}`)}
          {renderReportMetric('Naqd oborot', formatCompactMoney(reportMoney(report, 'TotalCash', 'totalCash'), locale))}
          {renderReportMetric('Karta oborot', formatCompactMoney(reportMoney(report, 'TotalCard', 'totalCard'), locale))}
          {renderReportMetric('QR oborot', formatCompactMoney(reportMoney(report, 'TotalQR', 'totalQR'), locale))}
          {renderReportMetric('Qaytarilgan', formatCompactMoney(numberOf(report, 'TotalRefundAmount', 'totalRefundAmount'), locale))}
          {renderReportMetric('Sof jami', formatCompactMoney(numberOf(report, 'NetTotal', 'netTotal', 'TotalSaleAmount', 'totalSaleAmount'), locale))}
          {renderReportMetric('Fiscal cheklar', numberOf(report, 'FiscalReceiptCount', 'fiscalReceiptCount'))}
        </Stack>
      </Box>
    );
  };

  const renderProviderReport = (report: Record<string, unknown> | null) => {
    if (!report) {
      return null;
    }
    return (
      <Box
        sx={(theme) => ({
          borderRadius: 2,
          border: `1px solid ${alpha(theme.palette.text.primary, 0.12)}`,
          p: 1.5,
        })}>
        <Stack spacing={0.9}>
          <Typography variant="subtitle1">Unikassa Z-report</Typography>
          {renderReportMetric('Terminal ID', stringOf(report, 'TerminalID', 'terminalID', 'terminalId') || '-')}
          {renderReportMetric('Ochilgan vaqt', stringOf(report, 'OpenTime', 'openTime') || '-')}
          {renderReportMetric('Sotuvlar', numberOf(report, 'TotalSaleCount', 'totalSaleCount'))}
          {renderReportMetric('Qaytimlar', numberOf(report, 'TotalRefundCount', 'totalRefundCount'))}
          {renderReportMetric('Naqd', formatCompactMoney(reportMoney(report, 'TotalCash', 'totalCash', 'Sale', 100), locale))}
          {renderReportMetric('Karta', formatCompactMoney(reportMoney(report, 'TotalCard', 'totalCard', 'Sale', 100), locale))}
          {renderReportMetric('QQS', formatCompactMoney(reportMoney(report, 'TotalVAT', 'totalVAT', 'Sale', 100), locale))}
          {renderReportMetric('Birinchi chek', stringOf(report, 'FirstReceiptSeq', 'firstReceiptSeq') || '-')}
          {renderReportMetric('Oxirgi chek', stringOf(report, 'LastReceiptSeq', 'lastReceiptSeq') || '-')}
        </Stack>
      </Box>
    );
  };

  const renderFiscalMemoryReport = (report: Record<string, unknown> | null) => {
    if (!report) {
      return null;
    }
    return (
      <Box
        sx={(theme) => ({
          borderRadius: 2,
          border: `1px solid ${alpha(theme.palette.text.primary, 0.12)}`,
          p: 1.5,
        })}>
        <Stack spacing={0.9}>
          <Typography variant="subtitle1">Unikassa fiscal memory</Typography>
          {renderReportMetric('Terminal ID', stringOf(report, 'TerminalID', 'terminalID', 'terminalId') || '-')}
          {renderReportMetric('Oxirgi operatsiya', stringOf(report, 'LastOperationTime', 'lastOperationTime') || '-')}
          {renderReportMetric('Z-reportlar', numberOf(report, 'ZReportsCount', 'zReportsCount'))}
          {renderReportMetric('Cheklar', numberOf(report, 'ReceiptsCount', 'receiptsCount'))}
        </Stack>
      </Box>
    );
  };

  const renderCloseReportDialog = () => {
    const fiscalShift = asRecord(shiftCloseReport?.fiscalShift ?? shiftCloseReport?.fiscal_shift);
    const reports = asRecord(valueOf(fiscalShift, 'reports', 'report')) ?? asRecord(shiftCloseReport?.report);
    const posReport = asRecord(valueOf(reports, 'posReport', 'pos_report'));
    const result = asRecord(valueOf(fiscalShift, 'result'));
    const providerReport = asRecord(valueOf(fiscalShift, 'providerReport', 'provider_report')) ?? asRecord(valueOf(result, 'providerReport', 'provider_report'));
    const zInfo = asRecord(valueOf(providerReport, 'zInfo', 'z_info'));
    const fiscalMemory = asRecord(valueOf(providerReport, 'fiscalMemory', 'fiscal_memory'));
    return (
      <Dialog open={Boolean(shiftCloseReport)} onClose={() => setShiftCloseReport(null)} fullWidth maxWidth="sm" fullScreen={isMobile}>
        <DialogTitle>Smena hisoboti</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.5}>
            {renderUnikassaLikeReport('Bizning POS report', posReport)}
            {renderProviderReport(zInfo)}
            {renderFiscalMemoryReport(fiscalMemory)}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button variant="contained" onClick={() => setShiftCloseReport(null)}>
            Yopish
          </Button>
        </DialogActions>
      </Dialog>
    );
  };

  const renderShiftTotals = (shift: CashShiftSummary) => {
    const expectedCloseCash = Number(shift.expectedClosingCashAmount ?? 0);
    return (
      <Stack spacing={1}>
        <Stack direction="row" justifyContent="space-between">
          <Typography color="text.secondary">{copy.openingCash}</Typography>
          <Typography>{formatCompactMoney(shift.openingCashAmount, locale)}</Typography>
        </Stack>
        <Stack direction="row" justifyContent="space-between">
          <Typography color="text.secondary">{copy.expectedCash}</Typography>
          <Typography>{formatCompactMoney(expectedCloseCash, locale)}</Typography>
        </Stack>
        <Stack direction="row" justifyContent="space-between">
          <Typography color="text.secondary">{copy.shiftCashTotal}</Typography>
          <Typography>{formatCompactMoney(shift.cashTotal, locale)}</Typography>
        </Stack>
        <Stack direction="row" justifyContent="space-between">
          <Typography color="text.secondary">{copy.shiftCardTotal}</Typography>
          <Typography>{formatCompactMoney(shift.cardTotal, locale)}</Typography>
        </Stack>
        <Stack direction="row" justifyContent="space-between">
          <Typography color="text.secondary">{copy.shiftQrTotal}</Typography>
          <Typography>{formatCompactMoney(shift.qrTotal, locale)}</Typography>
        </Stack>
        <Stack direction="row" justifyContent="space-between">
          <Typography color="text.secondary">{copy.shiftRefundTotal}</Typography>
          <Typography>{formatCompactMoney(shift.refundTotal, locale)}</Typography>
        </Stack>
      </Stack>
    );
  };

  const renderManagerShift = (shift: CashShiftSummary) => {
    const isLastActiveShift = activeShifts.length === 1;
    const canCloseFiscalShift = isLastActiveShift && hasFiscalIntegration;
    const shouldCloseFiscalShift = closeFiscalByShift[shift.id] ?? true;
    return (
      <Box
        key={shift.id}
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
          {renderShiftTotals(shift)}
          <TextField
            label={copy.notes}
            value={closingNotesByShift[shift.id] ?? ''}
            onChange={(event) => updateClosingNotes(shift.id, event.target.value)}
            multiline
            minRows={2}
          />
          {canCloseFiscalShift ? (
            <FormControlLabel
              control={
                <Checkbox
                  checked={shouldCloseFiscalShift}
                  onChange={(event) => updateCloseFiscal(shift.id, event.target.checked)}
                />
              }
              label="Fiscal smenani ham yopish"
            />
          ) : null}
          <Button
            variant="contained"
            color="error"
            disabled={closeShiftMutation.isPending}
            onClick={() =>
              closeShiftMutation.mutate({
                cashShiftId: shift.id,
                notesClose: closingNotesByShift[shift.id] ?? '',
                closeFiscalShift: canCloseFiscalShift ? shouldCloseFiscalShift : false,
              })
            }>
            {closeShiftMutation.isPending ? copy.processing : copy.closeShift}
          </Button>
        </Stack>
      </Box>
    );
  };

  const renderOpenShiftFields = () => (
    <Stack spacing={2}>
      <TextField
        select
        label={copy.cashDesk}
        value={selectedCashDeskIdValue}
        onChange={(event) => setSelectedCashDeskId(event.target.value)}
        disabled={cashDesksAvailableToOpen.length <= 1}>
        {cashDesksAvailableToOpen.map((cashDesk) => (
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
          onChange={(event) => setSelectedCashierId(event.target.value)}>
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
        onChange={(event) => setOpeningCash(event.target.value)}
      />
      <TextField
        label={copy.notes}
        value={openingNotes}
        onChange={(event) => setOpeningNotes(event.target.value)}
        multiline
        minRows={2}
      />
    </Stack>
  );

  const openShift = () =>
    openShiftMutation.mutate({
      cashDeskId: selectedCashDeskIdValue || undefined,
      cashierId: requiresCashierSelection ? selectedCashierId || undefined : undefined,
      openingCashAmount: Number(openingCash || 0),
      notesOpen: openingNotes,
    });

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
            maxWidth: 620,
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
          ) : canManageShift ? (
            <Stack spacing={2.2}>
              {activeShifts.length ? (
                <Stack spacing={1.5}>
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1.25}
                    justifyContent="space-between"
                    alignItems={{ xs: 'stretch', sm: 'center' }}>
                    <Typography variant="h5">{copy.activeShifts}</Typography>
                    {cashDesksAvailableToOpen.length ? (
                      <Button variant="outlined" onClick={() => setOpenShiftDialogOpen(true)}>
                        Boshqa smenani ochish
                      </Button>
                    ) : null}
                  </Stack>
                  {activeShifts.map(renderManagerShift)}
                </Stack>
              ) : (
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="h5">{copy.openShift}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                      {copy.openShiftDescription}
                    </Typography>
                  </Box>
                  {renderOpenShiftFields()}
                  <Button variant="contained" size={isMobile ? 'large' : 'medium'} disabled={!canOpenShift} onClick={openShift}>
                    {openShiftMutation.isPending ? copy.processing : copy.openShift}
                  </Button>
                </Stack>
              )}

              {activeShifts.length && !cashDesksAvailableToOpen.length ? (
                <Typography variant="body2" color="text.secondary">
                  Barcha kassalarda smena ochilgan.
                </Typography>
              ) : null}
              {activeShifts.length ? (
                <Dialog
                  open={openShiftDialogOpen}
                  onClose={() => setOpenShiftDialogOpen(false)}
                  fullWidth
                  maxWidth="sm"
                  fullScreen={isMobile}>
                  <DialogTitle>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
                      <Box>
                        <Typography variant="h5">{copy.openShift}</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                          {copy.openShiftDescription}
                        </Typography>
                      </Box>
                      <PosIconAction icon="solar:close-circle-bold" onClick={() => setOpenShiftDialogOpen(false)} />
                    </Stack>
                  </DialogTitle>
                  <DialogContent dividers>{renderOpenShiftFields()}</DialogContent>
                  <DialogActions sx={{ px: 3, py: 2 }}>
                    <Button onClick={() => setOpenShiftDialogOpen(false)}>{copy.cancel}</Button>
                    <Button variant="contained" disabled={!canOpenShift} onClick={openShift}>
                      {openShiftMutation.isPending ? copy.processing : copy.openShift}
                    </Button>
                  </DialogActions>
                </Dialog>
              ) : null}
            </Stack>
          ) : currentShift ? (
            <Stack spacing={2}>
              <Box>
                <Typography variant="h5">{copy.currentShift}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                  {currentShift.cashDeskName}
                </Typography>
              </Box>

              {renderShiftTotals(currentShift)}

              <Button
                variant="contained"
                sx={(theme) => ({
                  backgroundImage: 'none',
                  backgroundColor: theme.palette.mode === 'dark' ? '#4d535a' : '#d8cfbf',
                  color: theme.palette.mode === 'dark' ? '#f5f5f5' : theme.palette.text.primary,
                })}
                onClick={() => navigate(nextPath, { replace: true })}>
                {copy.continueWork}
              </Button>
            </Stack>
          ) : (
            <Stack spacing={2}>
              <Typography variant="h5">{copy.shift}</Typography>
              <Typography variant="body2" color="text.secondary">
                {copy.shiftWaitingManager}
              </Typography>
              <Button
                variant="contained"
                sx={(theme) => ({
                  backgroundImage: 'none',
                  backgroundColor: theme.palette.mode === 'dark' ? '#4d535a' : '#d8cfbf',
                  color: theme.palette.mode === 'dark' ? '#f5f5f5' : theme.palette.text.primary,
                })}
                onClick={() => navigate(getPosHomePath(session), { replace: true })}>
                {copy.continueWork}
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
      {renderCloseReportDialog()}
    </PosPageFrame>
  );
}
