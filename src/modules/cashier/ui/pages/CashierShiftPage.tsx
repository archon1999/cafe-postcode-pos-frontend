import { Alert, Box, Button, Stack, Typography, alpha, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';

import {
  canCreateCashExpense,
  canManageCashShift,
  canViewCashShift,
  getPosHomePath,
  isCashierBuilderMode,
  usePosSession,
} from 'modules/auth';
import {
  useCashierContextQuery,
  useCloseCashierShiftMutation,
  useOpenCashierShiftMutation,
  usePrintCashierShiftReportMutation,
  useRecoverCashierShiftMutation,
} from 'modules/cashier/application';
import { type CashierShiftCloseResponse, getPaymentFailureState, isValidOpeningCash } from 'modules/cashier/domain';
import { requestEdgePrintDocuments } from 'modules/edge-printing/application';
import { getApiErrorMessage } from 'shared/api/errorMessage';
import { POS_CONTEXT_POLL_INTERVAL_MS } from 'shared/api/polling';
import { PosPageFrame } from 'shared/layout/PosPageFrame';
import { getPosCopy } from 'shared/locale/copy';
import { PosIconAction, PosSettingsMenu } from 'shared/ui/pos-primitives';

import { ManagerShiftCard, OpenShiftFields } from './CashierShiftControls';
import { EmployeeShiftPanel, ManagerShiftPanel, WaitingShiftPanel } from './CashierShiftPanels';
import { CashierShiftReportDialog } from './CashierShiftReportDialog';

export function CashierShiftPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { session, locale, setLocale, setSession, themeColor, setThemeColor, themeMode, setThemeMode } =
    usePosSession();
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
  const [recoveryErrors, setRecoveryErrors] = useState<Partial<Record<'open' | 'close', string>>>({});
  const [validationError, setValidationError] = useState<{
    operation: 'open' | 'close';
    detail: string;
    showChecks: boolean;
  } | null>(null);
  const recoveryOperation = recoveryErrors.open ? 'open' : recoveryErrors.close ? 'close' : null;

  const canViewShift = canViewCashShift(session?.user);
  const canManageShift = canManageCashShift(session?.user);
  const contextQuery = useCashierContextQuery({
    enabled: canViewShift,
    refetchInterval: POS_CONTEXT_POLL_INTERVAL_MS,
    refreshClosingShifts: true,
  });
  const nextPath =
    searchParams.get('next') || (isCashierBuilderMode(session?.user) ? '/cashier/builder' : '/cashier/open-checks');
  const currentShift = contextQuery.data?.currentShift ?? null;
  const activeShifts = useMemo(() => contextQuery.data?.activeShifts ?? [], [contextQuery.data?.activeShifts]);
  const pendingClosedShifts = contextQuery.data?.pendingClosedShifts ?? [];
  const availableCashDesks = useMemo(
    () => contextQuery.data?.availableCashDesks ?? [],
    [contextQuery.data?.availableCashDesks],
  );
  const availableCashiers = contextQuery.data?.availableCashiers ?? [];
  const activeCashDeskIds = useMemo(() => new Set(activeShifts.map((shift) => shift.cashDesk)), [activeShifts]);
  const cashDesksAvailableToOpen = useMemo(
    () => availableCashDesks.filter((cashDesk) => !activeCashDeskIds.has(cashDesk.id)),
    [activeCashDeskIds, availableCashDesks],
  );

  const clearRecoveryError = (operation: 'open' | 'close') => {
    setRecoveryErrors((previous) => ({ ...previous, [operation]: undefined }));
    setValidationError((previous) => (previous?.operation === operation ? null : previous));
  };
  const onShiftError = (operation: 'open' | 'close', error: unknown) => {
    const detail = getApiErrorMessage(error, copy.financialResultUnknown);
    const failure = getPaymentFailureState(error);
    if (failure.state === 'failed') {
      clearRecoveryError(operation);
      setValidationError({ operation, detail, showChecks: failure.code === 'EDGE_SHIFT_HAS_OPEN_ORDERS' });
      return;
    }
    setRecoveryErrors((previous) => ({ ...previous, [operation]: detail }));
  };
  const openShiftMutation = useOpenCashierShiftMutation({
    onSuccess: () => {
      clearRecoveryError('open');
      setSelectedCashDeskId('');
      setSelectedCashierId('');
      setOpeningCash('0');
      setOpeningNotes('');
      setOpenShiftDialogOpen(false);
      if (!canManageShift) {
        void navigate(nextPath, { replace: true });
      }
    },
    onError: (error) => onShiftError('open', error),
  });
  const printShiftReportMutation = usePrintCashierShiftReportMutation();
  const closeShiftMutation = useCloseCashierShiftMutation({
    onSuccess: (response) => {
      clearRecoveryError('close');
      void contextQuery.refetch();
      if (response.printDocuments?.length) {
        requestEdgePrintDocuments(response.printDocuments);
      }
      if (response.printReportError) {
        toast.error(`Smena yopildi, lekin hisobot tayyorlanmadi: ${response.printReportError}`);
      }
      if (response.syncState === 'pending' || response.closeState === 'closed_local') {
        toast.info(copy.shiftClosedLocal);
      }
      if (response.closedShift || response.report || response.fiscalShift || response.fiscal_shift) {
        setShiftCloseReport(response);
      }
    },
    onError: (error) => onShiftError('close', error),
  });

  const onRecoveredShift = (operation: 'open' | 'close', response: CashierShiftCloseResponse | null) => {
    clearRecoveryError(operation);
    if (!response) return;
    void contextQuery.refetch();
    if (response.closedShift || response.report || response.fiscalShift || response.fiscal_shift)
      setShiftCloseReport(response);
  };
  const { mutate: recoverOpenShift, isPending: recoveringOpen } = useRecoverCashierShiftMutation('open', {
    onSuccess: (response) => onRecoveredShift('open', response),
    onError: (error) => onShiftError('open', error),
  });
  const { mutate: recoverCloseShift, isPending: recoveringClose } = useRecoverCashierShiftMutation('close', {
    onSuccess: (response) => onRecoveredShift('close', response),
    onError: (error) => onShiftError('close', error),
  });
  useEffect(() => {
    if (!canManageShift) return;
    recoverOpenShift(false);
    recoverCloseShift(false);
  }, [canManageShift, recoverOpenShift, recoverCloseShift]);

  const selectedCashDeskIdValue =
    selectedCashDeskId || (cashDesksAvailableToOpen.length === 1 ? (cashDesksAvailableToOpen[0]?.id ?? '') : '');
  const requiresCashierSelection = availableCashDesks.length > 1;
  const canOpenShift = Boolean(
    canManageShift &&
      isValidOpeningCash(openingCash) &&
      selectedCashDeskIdValue &&
      (!requiresCashierSelection || selectedCashierId) &&
      !openShiftMutation.isPending &&
      !recoveryOperation,
  );

  if (!canViewShift) {
    return <Navigate to={getPosHomePath(session)} replace />;
  }

  const renderManagerShift = (shift: (typeof activeShifts)[number]) => {
    const closesFiscalShift = false;
    return (
      <ManagerShiftCard
        key={shift.id}
        closesFiscalShift={closesFiscalShift}
        closing={closeShiftMutation.isPending}
        locale={locale}
        onClose={(includeSoldItems) => {
          if (recoveryErrors.close) {
            recoverCloseShift(true);
            return;
          }
          closeShiftMutation.mutate({
            cashShiftId: shift.id,
            notesClose: '',
            closeFiscalShift: closesFiscalShift,
            includeSoldItems,
          });
        }}
        onPrint={async () => {
          try {
            const response = await printShiftReportMutation.mutateAsync({ cashShiftId: shift.id });
            requestEdgePrintDocuments(response.printDocuments ?? []);
          } catch (error) {
            toast.error(getApiErrorMessage(error, 'Hisobotni chiqarishda xatolik bor.'));
          }
        }}
        printing={printShiftReportMutation.isPending}
        shift={shift}
      />
    );
  };

  const renderOpenShiftFields = () => (
    <OpenShiftFields
      availableCashDesks={cashDesksAvailableToOpen}
      availableCashiers={availableCashiers}
      locale={locale}
      onCashDeskChange={setSelectedCashDeskId}
      onCashierChange={setSelectedCashierId}
      onOpeningCashChange={setOpeningCash}
      onOpeningNotesChange={setOpeningNotes}
      openingCash={openingCash}
      openingNotes={openingNotes}
      requiresCashierSelection={requiresCashierSelection}
      selectedCashDeskId={selectedCashDeskIdValue}
      selectedCashierId={selectedCashierId}
    />
  );

  const openShift = () => {
    if (!canOpenShift) return;
    openShiftMutation.mutate({
      cashDeskId: selectedCashDeskIdValue || undefined,
      cashierId: requiresCashierSelection ? selectedCashierId || undefined : undefined,
      openingCashAmount: Number(openingCash || 0),
      notesOpen: openingNotes,
    });
  };

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
          overflowY: 'auto',
          overflowX: 'hidden',
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr)',
          justifyItems: 'center',
          alignItems: 'start',
          py: 1,
        }}>
        <Box
          sx={(theme) => ({
            width: '100%',
            maxWidth: 620,
            minWidth: 0,
            borderRadius: '18px',
            p: { xs: 2, md: 2.6 },
            backgroundColor: 'var(--pos-content-panel-bg)',
            border: `1px solid ${alpha('#ffffff', theme.palette.mode === 'dark' ? 0.05 : 0.32)}`,
            boxShadow: 'var(--pos-content-panel-shadow)',
          })}>
          {validationError ? (
            <Alert
              severity="warning"
              sx={{ mb: 2 }}
              action={
                validationError.showChecks ? (
                  <Button onClick={() => navigate('/cashier/open-checks')}>{copy.openChecks}</Button>
                ) : undefined
              }>
              {validationError.detail}
            </Alert>
          ) : null}
          {recoveryOperation ? (
            <Alert
              severity="warning"
              sx={{ mb: 2 }}
              action={
                <Button
                  disabled={recoveringOpen || recoveringClose}
                  onClick={() => (recoveryOperation === 'open' ? recoverOpenShift(true) : recoverCloseShift(true))}>
                  {copy.checkFinancialResult}
                </Button>
              }>
              {recoveryErrors[recoveryOperation]}
            </Alert>
          ) : null}
          {contextQuery.isLoading && !contextQuery.data ? (
            <Typography variant="h6" color="text.secondary">
              {copy.processing}
            </Typography>
          ) : canManageShift ? (
            <ManagerShiftPanel
              activeShifts={[
                ...activeShifts,
                ...pendingClosedShifts.filter((pending) => !activeShifts.some((active) => active.id === pending.id)),
              ]}
              availableCashDeskCount={cashDesksAvailableToOpen.length}
              canOpenShift={canOpenShift}
              isMobile={isMobile}
              locale={locale}
              openShiftDialogOpen={openShiftDialogOpen}
              opening={openShiftMutation.isPending}
              openShiftFields={renderOpenShiftFields()}
              onOpenDialogChange={setOpenShiftDialogOpen}
              onOpenShift={openShift}
              renderShift={renderManagerShift}
            />
          ) : currentShift ? (
            <EmployeeShiftPanel
              currentShift={currentShift}
              locale={locale}
              onContinue={() => navigate(nextPath, { replace: true })}
            />
          ) : (
            <WaitingShiftPanel
              locale={locale}
              onContinue={() => navigate(getPosHomePath(session), { replace: true })}
            />
          )}
        </Box>
      </Box>

      <PosSettingsMenu
        anchorEl={settingsAnchor}
        locale={locale}
        onClose={() => setSettingsAnchor(null)}
        onLocaleChange={setLocale}
        onExpense={canCreateCashExpense(session?.user) ? () => navigate('/cashier/expenses') : undefined}
        onLock={() => navigate('/lock-screen')}
        onRefresh={() => void contextQuery.refetch()}
        onThemeToggle={() => setThemeMode(themeMode === 'dark' ? 'light' : 'dark')}
        onThemeColorChange={setThemeColor}
        onSignOut={() => {
          setSession(null);
          void navigate('/pin-login', { replace: true });
        }}
        themeColor={themeColor}
        themeMode={themeMode}
      />
      <CashierShiftReportDialog
        fullScreen={isMobile}
        locale={locale}
        onClose={() => setShiftCloseReport(null)}
        report={shiftCloseReport}
      />
    </PosPageFrame>
  );
}
