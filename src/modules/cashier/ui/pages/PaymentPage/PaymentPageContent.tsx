import { Box, Stack, alpha, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';

import {
  canAccessTakeawayBuilder,
  canCreateCashExpense,
  canManageCashierPayments,
  canSkipFiscalReceipts,
  usePosSession,
} from 'modules/auth';
import {
  useCashierContextQuery,
  useCashierOrderScanMutation,
  useCashierPaymentOrderQuery,
} from 'modules/cashier/application';
import {
  aggregateCashierOrderItems,
  getCashierOrderDisplayName,
  getCashierOrderNumberLabel,
} from 'modules/cashier/domain';
import { requestEdgePrintDocuments } from 'modules/edge-printing/application';
import { getApiErrorMessage } from 'shared/api/errorMessage';
import { POS_CONTEXT_POLL_INTERVAL_MS } from 'shared/api/polling';
import { refreshTransportAndReload } from 'shared/api/transportResolver';
import { PosPageFrame } from 'shared/layout/PosPageFrame';
import { getPosCopy } from 'shared/locale/copy';
import { useScannerInput } from 'shared/pos/useScannerInput';
import { PosSettingsMenu } from 'shared/ui/pos-primitives';

import { PaymentCheckoutSummary } from './PaymentCheckoutSummary';
import { PaymentMethodEditor } from './PaymentMethodEditor';
import { PaymentOrderPanel } from './PaymentOrderPanel';
import { PaymentPageHeader, PaymentPageToasts } from './PaymentPageChrome';
import { CardFailureDialog, ReceiptDialogs, RenameOrderDialog } from './PaymentPageDialogs';
import { usePaymentEditorState } from './usePaymentEditorState';
import { usePaymentOrderEditing } from './usePaymentOrderEditing';
import { usePaymentReceiptFlow } from './usePaymentReceiptFlow';
import { usePaymentSubmission } from './usePaymentSubmission';

export type PaymentPageContentProps = {
  orderId?: string | null;
};

function formatPercent(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');
}

export function PaymentPageContent({ orderId }: PaymentPageContentProps) {
  const navigate = useNavigate();
  const { session, locale, setLocale, setSession, themeColor, setThemeColor, themeMode, setThemeMode } =
    usePosSession();
  const copy = getPosCopy(locale);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [settingsAnchor, setSettingsAnchor] = useState<HTMLElement | null>(null);
  const canProcessPayments = canManageCashierPayments(session?.user);
  const canDisableFiscalRegistration = canSkipFiscalReceipts(session?.user);
  const normalizedOrderId = orderId ?? null;

  const cashierContextQuery = useCashierContextQuery({
    enabled: Boolean(session?.token) && canProcessPayments,
    refetchInterval: canProcessPayments ? POS_CONTEXT_POLL_INTERVAL_MS : false,
  });
  const orderQuery = useCashierPaymentOrderQuery(normalizedOrderId);
  const scanMarkingMutation = useCashierOrderScanMutation({
    orderId: normalizedOrderId,
    mode: 'remove',
  });
  const selectedCashDesk = useMemo(() => {
    const cashDesks = cashierContextQuery.data?.availableCashDesks ?? [];
    const activeCashDeskId = cashierContextQuery.data?.currentShift?.cashDesk;
    return cashDesks.find((cashDesk) => cashDesk.id === activeCashDeskId) ?? cashDesks[0] ?? null;
  }, [cashierContextQuery.data?.availableCashDesks, cashierContextQuery.data?.currentShift?.cashDesk]);
  const remainingTotal = useMemo(() => {
    const total = Number(orderQuery.data?.total ?? 0);
    const paidTotal = (orderQuery.data?.payments ?? [])
      .filter((payment) => payment.status === 'succeeded')
      .reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);

    return Math.max(total - paidTotal, 0);
  }, [orderQuery.data?.payments, orderQuery.data?.total]);
  const {
    method,
    amount,
    splitParts,
    paymentOptions,
    paymentAmount,
    splitTotal,
    pendingSplitTotal,
    hasZeroSplitAmount,
    isPaymentAmountValid,
    isSplitPaymentValid,
    setAmount,
    setSplitParts,
    selectMethod,
    createInitialSplitParts,
    updateSplitPart,
    removeSplitPart,
  } = usePaymentEditorState({
    remainingTotal,
    enabledMethods: selectedCashDesk?.enabledPaymentMethods,
    cashLabel: copy.cash,
    cardLabel: copy.card,
  });
  const aggregatedOrderItems = useMemo(
    () => aggregateCashierOrderItems(orderQuery.data?.items),
    [orderQuery.data?.items],
  );
  const orderNumberLabel = useMemo(
    () => getCashierOrderNumberLabel({ orderNumber: orderQuery.data?.orderNumber ?? 0 }),
    [orderQuery.data?.orderNumber],
  );
  const orderDisplayName = useMemo(
    () =>
      getCashierOrderDisplayName({
        orderNumber: orderQuery.data?.orderNumber ?? 0,
        displayName: orderQuery.data?.displayName,
      }),
    [orderQuery.data?.displayName, orderQuery.data?.orderNumber],
  );
  const hasCustomOrderName = Boolean(orderQuery.data?.displayName?.trim());
  const isBuilderOrder =
    !orderQuery.data?.tableSession &&
    (orderQuery.data?.channel === 'hall' ||
      orderQuery.data?.channel === 'takeaway' ||
      orderQuery.data?.channel === 'delivery');
  const orderEditing = usePaymentOrderEditing({
    displayName: orderQuery.data?.displayName,
    isBuilderOrder,
    orderId: normalizedOrderId,
    renameFailedMessage: copy.renameOrderFailed,
    user: session?.user,
  });
  const markingCheckEnabled = Boolean(session?.restaurantContext?.markingCheckEnabled);
  const markingMissingCount = useMemo(
    () =>
      (orderQuery.data?.items ?? []).reduce((sum, item) => {
        const required = Number(item.markingRequiredCount ?? 0);
        const scanned = Number(item.markingScannedCount ?? item.markings?.length ?? 0);
        return sum + Math.max(required - scanned, 0);
      }, 0),
    [orderQuery.data?.items],
  );

  const addPaymentPartLabel = "Bo'lak qo'shish";
  const splitPaymentTitle = "To'lov bo'laklari";

  const afterPaymentPath =
    isBuilderOrder && canAccessTakeawayBuilder(session?.user) ? '/cashier/builder' : '/cashier/open-checks';
  const {
    receiptData,
    setReceiptData,
    printToastOpen,
    setPrintToastOpen,
    receiptPrintPromptOpen,
    setReceiptPrintPromptOpen,
    isReceiptPrintConfirming,
    finishReceiptFlow,
    handleSuccessfulPaymentResponse,
    handleReceiptPromptPrint,
  } = usePaymentReceiptFlow({
    afterPaymentPath,
    remainingTotal,
    clearSplitParts: () => setSplitParts(null),
    onPrintDocuments: (documentIds) => requestEdgePrintDocuments(documentIds),
    onPrintError: (message) => toast.error(message),
    setAmount,
  });
  const paymentSubmission = usePaymentSubmission({
    amount,
    method,
    orderId: normalizedOrderId,
    paymentAmount,
    paymentFailedMessage: copy.paymentFailed,
    splitParts,
    onPaymentComplete: handleSuccessfulPaymentResponse,
    onManualPaymentComplete: setReceiptData,
    setAmount,
    setSplitParts,
  });
  const isSplitPayment = Boolean(splitParts);
  const splitValidationMessage = hasZeroSplitAmount ? copy.zeroAmountNotAllowed : copy.mixedAmountMismatch;
  const isPaymentProcessing = paymentSubmission.isSubmitting;
  const canSubmitPayment = Boolean(
    normalizedOrderId &&
      canProcessPayments &&
      cashierContextQuery.data?.currentShift &&
      (!markingCheckEnabled || markingMissingCount === 0) &&
      isPaymentAmountValid &&
      (isSplitPayment ? pendingSplitTotal <= remainingTotal : paymentAmount <= remainingTotal) &&
      isSplitPaymentValid &&
      !isPaymentProcessing,
  );
  const serviceFeePercent = Number(orderQuery.data?.serviceFeePercent ?? 0);
  const serviceFeeAmount = Number(orderQuery.data?.serviceFee ?? 0);
  const serviceFeeEnabled = Boolean(orderQuery.data?.serviceFeeEnabled ?? serviceFeePercent > 0);
  const shouldShowServiceFee = serviceFeeEnabled && (serviceFeePercent > 0 || serviceFeeAmount > 0);
  const serviceFeeLabel = `${copy.serviceFee} (${serviceFeePercent}%)`;
  const vatEnabled = Boolean(orderQuery.data?.vatEnabled);
  const vatPercent = Number(orderQuery.data?.vatPercent ?? 0);
  const vatAmount = Number(orderQuery.data?.vatAmount ?? 0);
  const shouldShowVat = vatEnabled && vatPercent > 0;
  const vatLabel = `${copy.vat} (${formatPercent(vatPercent)}%)`;
  useScannerInput({
    enabled: Boolean(normalizedOrderId && canProcessPayments && !receiptData),
    onScan: async (rawCode) => {
      try {
        await scanMarkingMutation.mutateAsync(rawCode);
      } catch (error) {
        paymentSubmission.reportError(
          new Error(getApiErrorMessage(error, 'Bunaqa mahsulot orderda yo‘q yoki markirovka kodi yaroqsiz.')),
        );
      }
    },
  });

  return (
    <PosPageFrame
      header={
        <PaymentPageHeader
          copy={copy}
          isMobile={isMobile}
          onBack={() => navigate(afterPaymentPath)}
          onLock={() => navigate('/lock-screen')}
          onRefresh={() => void refreshTransportAndReload()}
          onSettings={(event) => setSettingsAnchor(event.currentTarget)}
        />
      }>
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: { xs: 'auto', md: 'hidden' },
          overflowX: 'hidden',
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            md: 'minmax(0, 1fr) clamp(320px, 34vw, 360px)',
            xl: 'minmax(0, 1fr) clamp(380px, 24vw, 430px)',
          },
          gap: { xs: 1.5, md: 1.6, xl: 2.4 },
          alignContent: { xs: 'start', md: 'stretch' },
          alignItems: { xs: 'start', md: 'stretch' },
          pb: 0.4,
        }}>
        <PaymentOrderPanel
          addingItemId={orderEditing.addingItemId}
          addPending={orderEditing.addPending}
          canAddItems={orderEditing.canAddItems}
          canRemoveItems={orderEditing.canRemoveItems}
          copy={copy}
          hasCustomOrderName={hasCustomOrderName}
          items={aggregatedOrderItems}
          locale={locale}
          onAddItem={(item) => void orderEditing.addItem(item.id, item.catalogItem, item.note, item.modifiers)}
          onRemoveItem={(itemId) => void orderEditing.removeItem(itemId)}
          onRename={orderEditing.openRenameDialog}
          order={orderQuery.data}
          orderDisplayName={orderDisplayName}
          orderNumberLabel={orderNumberLabel}
          removePending={orderEditing.removePending}
          removingItemId={orderEditing.removingItemId}
        />

        <Box
          sx={(muiTheme) => ({
            borderRadius: '14px',
            backgroundColor: 'var(--pos-content-panel-bg)',
            p: { xs: 1.8, md: 2.4 },
            border: `1px solid ${alpha('#ffffff', muiTheme.palette.mode === 'dark' ? 0.04 : 0.28)}`,
            minHeight: 0,
            overflowY: { xs: 'visible', md: 'auto' },
            overflowX: 'hidden',
          })}>
          <Stack spacing={2.2}>
            <PaymentMethodEditor
              addPaymentPartLabel={addPaymentPartLabel}
              amount={amount}
              copy={copy}
              hasZeroSplitAmount={hasZeroSplitAmount}
              isPaymentAmountValid={isPaymentAmountValid}
              isSplitPaymentValid={isSplitPaymentValid}
              locale={locale}
              method={method}
              onAmountChange={setAmount}
              onCreateSplit={createInitialSplitParts}
              onMethodChange={selectMethod}
              onRemoveSplitPart={removeSplitPart}
              onUpdateSplitPart={updateSplitPart}
              paymentOptions={paymentOptions}
              splitParts={splitParts}
              splitPaymentTitle={splitPaymentTitle}
              splitTotal={splitTotal}
              splitValidationMessage={splitValidationMessage}
            />

            <PaymentCheckoutSummary
              canDisableFiscalRegistration={canDisableFiscalRegistration}
              canSubmitPayment={canSubmitPayment}
              copy={copy}
              currentShiftOpen={Boolean(cashierContextQuery.data?.currentShift)}
              grandTotal={orderQuery.data?.total}
              isPaymentProcessing={isPaymentProcessing}
              locale={locale}
              markingCheckEnabled={markingCheckEnabled}
              markingMissingCount={markingMissingCount}
              onPay={(registerFiscal) => void paymentSubmission.submitPayment(registerFiscal)}
              remainingTotal={remainingTotal}
              selectedCashDeskName={selectedCashDesk?.name}
              serviceFee={orderQuery.data?.serviceFee}
              serviceFeeLabel={serviceFeeLabel}
              shouldShowServiceFee={shouldShowServiceFee}
              shouldShowVat={shouldShowVat}
              subtotal={orderQuery.data?.subtotal}
              vatAmount={vatAmount}
              vatLabel={vatLabel}
            />
          </Stack>
        </Box>
      </Box>

      <CardFailureDialog
        copy={copy}
        debugJson={paymentSubmission.cardFailureDebugJson}
        failureMessage={paymentSubmission.cardFailureMessage}
        fullScreen={isMobile}
        isPaymentProcessing={isPaymentProcessing}
        method={method}
        open={paymentSubmission.cardFailureOpen}
        onClose={paymentSubmission.closeCardFailure}
        onCopyDebug={() => void paymentSubmission.copyCardFailureDebug()}
        onManualComplete={() => void paymentSubmission.completeCardManually()}
        onRetry={() => {
          paymentSubmission.closeCardFailure();
          void paymentSubmission.submitPayment(paymentSubmission.pendingRegisterFiscal);
        }}
      />

      <RenameOrderDialog
        copy={copy}
        error={orderEditing.renameError}
        fullScreen={isMobile}
        isSaving={orderEditing.renamePending}
        open={orderEditing.renameDialogOpen}
        orderNumber={orderQuery.data?.orderNumber ?? 0}
        orderNumberLabel={orderNumberLabel}
        value={orderEditing.renameValue}
        onCancel={orderEditing.closeRenameDialog}
        onChange={orderEditing.changeRenameValue}
        onSave={() => void orderEditing.saveRename()}
      />

      <ReceiptDialogs
        copy={copy}
        fullScreen={isMobile}
        isPrintConfirming={isReceiptPrintConfirming}
        locale={locale}
        printPromptOpen={receiptPrintPromptOpen}
        receiptData={receiptData}
        onCloseReceipt={() => setReceiptData(null)}
        onFinish={finishReceiptFlow}
        onPrint={() => void handleReceiptPromptPrint()}
        onSetPrintPromptOpen={setReceiptPrintPromptOpen}
      />

      <PaymentPageToasts
        copy={copy}
        errorMessage={paymentSubmission.errorMessage}
        errorOpen={paymentSubmission.errorToastOpen}
        printOpen={printToastOpen}
        onErrorClose={() => paymentSubmission.setErrorToastOpen(false)}
        onPrintClose={() => setPrintToastOpen(false)}
      />

      <PosSettingsMenu
        anchorEl={settingsAnchor}
        locale={locale}
        onClose={() => setSettingsAnchor(null)}
        onLocaleChange={setLocale}
        onRefresh={isMobile ? () => window.location.reload() : undefined}
        onShift={() => navigate(`/cashier/shift?next=${encodeURIComponent(afterPaymentPath)}`)}
        onExpense={canCreateCashExpense(session?.user) ? () => navigate('/cashier/expenses') : undefined}
        onLock={isMobile ? () => navigate('/lock-screen') : undefined}
        onThemeToggle={() => setThemeMode(themeMode === 'dark' ? 'light' : 'dark')}
        onThemeColorChange={setThemeColor}
        onSignOut={() => {
          setSession(null);
          void navigate('/pin-login', { replace: true });
        }}
        themeColor={themeColor}
        themeMode={themeMode}
      />
    </PosPageFrame>
  );
}
