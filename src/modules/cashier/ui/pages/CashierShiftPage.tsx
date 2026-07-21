import { Box, Stack, Typography, alpha, useMediaQuery } from '@mui/material';
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
  usePrintCashierShiftReportMutation,
} from 'modules/cashier/application';
import type { CashierShiftCloseResponse } from 'modules/cashier/domain';
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
  const [closeFiscalByShift, setCloseFiscalByShift] = useState<Record<string, boolean>>({});

  const hasCashierAccess = canAccessCashier(session?.user);
  const canManageShift = canManageCashShift(session?.user);
  const contextQuery = useCashierContextQuery({
    enabled: hasCashierAccess,
    refetchInterval: POS_CONTEXT_POLL_INTERVAL_MS,
  });
  const nextPath =
    searchParams.get('next') || (isCashierBuilderMode(session?.user) ? '/cashier/builder' : '/cashier/open-checks');
  const currentShift = contextQuery.data?.currentShift ?? null;
  const activeShifts = useMemo(() => contextQuery.data?.activeShifts ?? [], [contextQuery.data?.activeShifts]);
  const availableCashDesks = useMemo(
    () => contextQuery.data?.availableCashDesks ?? [],
    [contextQuery.data?.availableCashDesks],
  );
  const availableCashiers = contextQuery.data?.availableCashiers ?? [];
  const fiscalShiftOpen = Boolean(contextQuery.data?.fiscalShiftOpen);
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
        void navigate(nextPath, { replace: true });
      }
    },
  });
  const printShiftReportMutation = usePrintCashierShiftReportMutation();
  const closeShiftMutation = useCloseCashierShiftMutation({
    onSuccess: (response) => {
      void contextQuery.refetch();
      if (response.printDocuments?.length) {
        requestEdgePrintDocuments(response.printDocuments);
      }
      if (response.printReportError) {
        toast.error(`Smena yopildi, lekin hisobot tayyorlanmadi: ${response.printReportError}`);
      }
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

  const updateCloseFiscal = (shiftId: string, value: boolean) => {
    setCloseFiscalByShift((prev) => ({ ...prev, [shiftId]: value }));
  };

  const renderManagerShift = (shift: (typeof activeShifts)[number]) => {
    const isLastActiveShift = activeShifts.length === 1;
    const canCloseFiscalShift = isLastActiveShift && hasFiscalIntegration && fiscalShiftOpen;
    const shouldCloseFiscalShift = closeFiscalByShift[shift.id] ?? true;
    return (
      <ManagerShiftCard
        key={shift.id}
        canCloseFiscalShift={canCloseFiscalShift}
        closeFiscalShift={shouldCloseFiscalShift}
        closing={closeShiftMutation.isPending}
        locale={locale}
        onClose={() =>
          closeShiftMutation.mutate({
            cashShiftId: shift.id,
            notesClose: '',
            closeFiscalShift: canCloseFiscalShift ? shouldCloseFiscalShift : false,
          })
        }
        onCloseFiscalChange={(value) => updateCloseFiscal(shift.id, value)}
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
          {contextQuery.isLoading && !contextQuery.data ? (
            <Typography variant="h6" color="text.secondary">
              {copy.processing}
            </Typography>
          ) : canManageShift ? (
            <ManagerShiftPanel
              activeShifts={activeShifts}
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
