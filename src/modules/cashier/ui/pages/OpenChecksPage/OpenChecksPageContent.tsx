import { Box, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';

import { canManageCashierPayments, usePosSession } from 'modules/auth';
import {
  useCashierEnsurePaymentPrintDocumentMutation,
  useCashierContextQuery,
  useCashierOpenChecksQuery,
  useCashierRefundMutation,
  useCashierUpdateOrderDisplayNameMutation,
} from 'modules/cashier/application';
import {
  aggregateCashierOrderItems,
  getCashierOrderDisplayName,
  getCashierOrderNumberLabel,
  groupCashierOrderItemsByStation,
  isCashierFiscalIntegrationReady,
} from 'modules/cashier/domain';
import type { CashierCheckStatus, CashierOrder } from 'modules/cashier/domain/entities/order.types';
import { requestEdgePrintDocuments } from 'modules/edge-printing/application';
import { POS_CONTEXT_POLL_INTERVAL_MS } from 'shared/api/polling';
import { refreshTransportAndReload } from 'shared/api/transportResolver';
import { PosPageFrame } from 'shared/layout/PosPageFrame';
import { getPosCopy } from 'shared/locale/copy';
import { PosOpenChecksSkeleton, PosSettingsMenu } from 'shared/ui/pos-primitives';

import { OpenChecksDetail } from './OpenChecksDetail';
import { RenameOpenCheckDialog, RetryFiscalReceiptDialogs } from './OpenChecksDialogs';
import { OpenChecksHeader, OpenChecksListPanel, OpenChecksMobileDetail } from './OpenChecksPageChrome';
import { useRetryFiscalReceiptFlow } from './useRetryFiscalReceiptFlow';
type ChecksQueryData = { orders?: CashierOrder[]; count?: number; numPages?: number } | CashierOrder[] | undefined;
type MutationErrorPayload = {
  displayName?: string[];
  detail?: string;
};

function getChecksOrders(data: ChecksQueryData) {
  return Array.isArray(data) ? data : (data?.orders ?? []);
}

function getChecksCount(data: ChecksQueryData) {
  return Array.isArray(data) ? data.length : (data?.count ?? data?.orders?.length ?? 0);
}

export function OpenChecksPageContent() {
  const navigate = useNavigate();
  const { session, locale, setLocale, setSession, themeColor, setThemeColor, themeMode, setThemeMode } =
    usePosSession();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const copy = getPosCopy(locale);
  const canOperatePayments = canManageCashierPayments(session?.user);
  const [settingsAnchor, setSettingsAnchor] = useState<HTMLElement | null>(null);
  const [selectedTab, setSelectedTab] = useState<CashierCheckStatus>('open');
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [renameOrder, setRenameOrder] = useState<CashierOrder | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState('');
  const [closedSearch, setClosedSearch] = useState('');
  const [closedPage, setClosedPage] = useState(1);
  const [fiscalSearch, setFiscalSearch] = useState('');
  const [fiscalPage, setFiscalPage] = useState(1);
  const refundMutation = useCashierRefundMutation();
  const ensurePrintDocumentMutation = useCashierEnsurePaymentPrintDocumentMutation();
  const cashierContextQuery = useCashierContextQuery({
    enabled: canOperatePayments,
    refetchInterval: canOperatePayments ? POS_CONTEXT_POLL_INTERVAL_MS : false,
  });
  const updateOrderDisplayNameMutation = useCashierUpdateOrderDisplayNameMutation({
    onSuccess: () => {
      setRenameOrder(null);
      setRenameError('');
    },
  });

  const openOrdersQuery = useCashierOpenChecksQuery('open');
  const closedOrdersQuery = useCashierOpenChecksQuery(
    'closed',
    {
      search: closedSearch,
      page: closedPage,
      pageSize: 20,
    },
    { refetchInterval: selectedTab === 'closed' ? 15_000 : false },
  );
  const fiscalClosedQuery = useCashierOpenChecksQuery(
    'fiscal_closed',
    {
      search: fiscalSearch,
      page: fiscalPage,
      pageSize: 20,
    },
    { refetchInterval: selectedTab === 'fiscal_closed' ? 15_000 : false },
  );
  const isInitialLoading =
    openOrdersQuery.isLoading && closedOrdersQuery.isLoading && !openOrdersQuery.data && !closedOrdersQuery.data;
  const openOrders = useMemo(() => getChecksOrders(openOrdersQuery.data), [openOrdersQuery.data]);
  const closedOrders = useMemo(() => getChecksOrders(closedOrdersQuery.data), [closedOrdersQuery.data]);
  const fiscalClosedOrders = useMemo(() => getChecksOrders(fiscalClosedQuery.data), [fiscalClosedQuery.data]);
  const visibleOrders =
    selectedTab === 'open' ? openOrders : selectedTab === 'closed' ? closedOrders : fiscalClosedOrders;
  const selectedOrder =
    visibleOrders.find((order) => order.id === selectedOrderId) ?? (isMobile ? undefined : visibleOrders[0]);
  const groupedItems = useMemo(
    () => groupCashierOrderItemsByStation(aggregateCashierOrderItems(selectedOrder?.items), copy.menu),
    [copy.menu, selectedOrder?.items],
  );
  const latestSucceededPayment = useMemo(() => {
    const succeededPayments = [...(selectedOrder?.payments ?? [])].filter((payment) => payment.status === 'succeeded');

    return succeededPayments[succeededPayments.length - 1];
  }, [selectedOrder?.payments]);
  const retryReceiptFlow = useRetryFiscalReceiptFlow({
    copy,
    latestPayment: latestSucceededPayment,
    onFinished: () => {
      setSelectedOrderId('');
      void closedOrdersQuery.refetch();
      void fiscalClosedQuery.refetch();
    },
    printDocuments: (documentIds) => requestEdgePrintDocuments(documentIds),
  });
  const fiscalIntegrationReady = isCashierFiscalIntegrationReady(cashierContextQuery.data);
  const canRefund = Boolean(
    selectedTab !== 'open' && latestSucceededPayment?.id && !latestSucceededPayment?.isRefunded && canOperatePayments,
  );
  const canReprint = Boolean(selectedTab !== 'open' && canOperatePayments && latestSucceededPayment?.id);
  const canRetryFiscal = Boolean(selectedTab === 'closed' && latestSucceededPayment?.id && canOperatePayments);
  const renameOrderNumberLabel = renameOrder ? getCashierOrderNumberLabel(renameOrder) : copy.orders;
  const renameOrderPreview = renameOrder
    ? getCashierOrderDisplayName({ orderNumber: renameOrder.orderNumber, displayName: renameValue })
    : copy.orders;

  const handleOpenRenameDialog = (order: CashierOrder) => {
    setRenameOrder(order);
    setRenameValue(order.displayName?.trim() ?? '');
    setRenameError('');
  };

  const handleRenameSave = async () => {
    if (!renameOrder) {
      return;
    }

    try {
      await updateOrderDisplayNameMutation.mutateAsync({
        orderId: renameOrder.id,
        displayName: renameValue.trim(),
      });
    } catch (error) {
      const errorResponse = (error as { response?: { data?: MutationErrorPayload } })?.response?.data;
      setRenameError(errorResponse?.displayName?.[0] ?? errorResponse?.detail ?? copy.renameOrderFailed);
    }
  };

  const detailPanel = selectedOrder ? (
    <OpenChecksDetail
      copy={copy}
      fiscalIntegrationReady={fiscalIntegrationReady}
      groupedItems={groupedItems}
      latestSucceededPayment={latestSucceededPayment}
      locale={locale}
      onPay={() => navigate(`/cashier/payment?orderId=${selectedOrder.id}`)}
      onRefund={() => {
        if (!latestSucceededPayment?.id || refundMutation.isPending) {
          return;
        }
        refundMutation
          .mutateAsync({ paymentId: latestSucceededPayment.id })
          .then((response) => {
            if (response.receipt?.printDocument) {
              requestEdgePrintDocuments([response.receipt.printDocument]);
            }
          })
          .catch((error) =>
            toast.error(error instanceof Error ? error.message : 'Qaytarish chekini chiqarib bo‘lmadi'),
          );
      }}
      onReprint={() => {
        if (ensurePrintDocumentMutation.isPending || !latestSucceededPayment?.id) {
          return;
        }
        ensurePrintDocumentMutation
          .mutateAsync(latestSucceededPayment.id)
          .then((response) => {
            if (!response.receipt?.printDocument) {
              throw new Error('Chek uchun print hujjati tayyor emas');
            }
            requestEdgePrintDocuments([response.receipt.printDocument], (error) =>
              toast.info(error instanceof Error ? error.message : 'Printer so‘rovini yuborib bo‘lmadi'),
            );
          })
          .catch((error) => toast.info(error instanceof Error ? error.message : 'Printer ishlamayapti'));
      }}
      onRetryFiscal={() => {
        if (!latestSucceededPayment?.id || retryReceiptFlow.isRetrying) {
          return;
        }
        retryReceiptFlow.retry(latestSucceededPayment.id);
      }}
      order={selectedOrder}
      refundAvailable={canRefund}
      reprintAvailable={canReprint}
      retryFiscalAvailable={canRetryFiscal}
      selectedTab={selectedTab}
    />
  ) : null;

  const handleSwipeEdit = (order: CashierOrder) => {
    const channel = order.channel === 'delivery' || order.channel === 'hall' ? order.channel : 'takeaway';
    void navigate(`/cashier/builder?orderId=${order.id}&channel=${channel}`);
  };

  const isPagedChecksTab = selectedTab === 'closed' || selectedTab === 'fiscal_closed';
  const pagedChecksData = selectedTab === 'closed' ? closedOrdersQuery.data : fiscalClosedQuery.data;
  const pagedChecksPage = selectedTab === 'closed' ? closedPage : fiscalPage;
  const pagedChecksSearch = selectedTab === 'closed' ? closedSearch : fiscalSearch;
  const pagedChecksPageCount = Math.max(1, Array.isArray(pagedChecksData) ? 1 : (pagedChecksData?.numPages ?? 1));
  const handlePagedSearchChange = (value: string) => {
    if (selectedTab === 'closed') {
      setClosedSearch(value);
      setClosedPage(1);
      return;
    }
    setFiscalSearch(value);
    setFiscalPage(1);
  };
  const handlePagedPageChange = (page: number) => {
    if (selectedTab === 'closed') {
      setClosedPage(page);
      return;
    }
    setFiscalPage(page);
  };
  if (isInitialLoading) {
    return <PosOpenChecksSkeleton mobile={isMobile} />;
  }

  return (
    <PosPageFrame
      header={
        <OpenChecksHeader
          closedCount={getChecksCount(closedOrdersQuery.data)}
          copy={copy}
          fiscalCount={getChecksCount(fiscalClosedQuery.data)}
          isMobile={isMobile}
          openCount={openOrders.length}
          selectedTab={selectedTab}
          onLock={() => navigate('/lock-screen')}
          onRefresh={() => void refreshTransportAndReload()}
          onSettings={(event) => setSettingsAnchor(event.currentTarget)}
          onTabChange={(value) => {
            setSelectedTab(value);
            if (isMobile) setMobileDetailOpen(false);
          }}
        />
      }>
      {isMobile ? (
        <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <OpenChecksListPanel
            copy={copy}
            locale={locale}
            orders={visibleOrders}
            page={pagedChecksPage}
            pageCount={pagedChecksPageCount}
            paged={isPagedChecksTab}
            search={pagedChecksSearch}
            selectedOrderId={selectedOrderId}
            selectedTab={selectedTab}
            onPageChange={handlePagedPageChange}
            onRename={handleOpenRenameDialog}
            onSearchChange={handlePagedSearchChange}
            onSwipeEdit={handleSwipeEdit}
            onSelect={(orderId) => {
              setSelectedOrderId(orderId);
              setMobileDetailOpen(true);
            }}
          />
        </Box>
      ) : (
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              md: 'minmax(0, 1fr) clamp(320px, 34vw, 370px)',
              xl: 'minmax(0, 1fr) clamp(380px, 24vw, 430px)',
            },
            gap: { xs: 1.5, md: 1.6, xl: 2.4 },
          }}>
          <OpenChecksListPanel
            copy={copy}
            locale={locale}
            orders={visibleOrders}
            page={pagedChecksPage}
            pageCount={pagedChecksPageCount}
            paged={isPagedChecksTab}
            search={pagedChecksSearch}
            selectedOrderId={selectedOrder?.id}
            selectedTab={selectedTab}
            onPageChange={handlePagedPageChange}
            onRename={handleOpenRenameDialog}
            onSearchChange={handlePagedSearchChange}
            onSelect={setSelectedOrderId}
            onSwipeEdit={handleSwipeEdit}
          />
          <Box sx={{ minHeight: 0 }}>{detailPanel}</Box>
        </Box>
      )}

      <OpenChecksMobileDetail
        copy={copy}
        detail={detailPanel}
        open={isMobile && mobileDetailOpen}
        order={selectedOrder}
        onClose={() => setMobileDetailOpen(false)}
      />

      <RetryFiscalReceiptDialogs
        copy={copy}
        dialog={retryReceiptFlow.dialog}
        fullScreen={isMobile}
        isPrintConfirming={retryReceiptFlow.isPrintConfirming}
        locale={locale}
        printPromptOpen={retryReceiptFlow.printPromptOpen}
        onClose={retryReceiptFlow.close}
        onFinish={retryReceiptFlow.finish}
        onPrint={() => void retryReceiptFlow.print()}
        onSetPrintPromptOpen={retryReceiptFlow.setPrintPromptOpen}
      />

      <PosSettingsMenu
        anchorEl={settingsAnchor}
        locale={locale}
        onClose={() => setSettingsAnchor(null)}
        onLocaleChange={setLocale}
        onRefresh={isMobile ? () => window.location.reload() : undefined}
        onShift={() => navigate('/cashier/shift?next=/cashier/open-checks')}
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

      <RenameOpenCheckDialog
        copy={copy}
        error={renameError}
        fullScreen={isMobile}
        helperText={renameOrderNumberLabel}
        isSaving={updateOrderDisplayNameMutation.isPending}
        open={Boolean(renameOrder)}
        preview={renameOrderPreview}
        value={renameValue}
        onCancel={() => setRenameOrder(null)}
        onChange={(value) => {
          setRenameValue(value);
          if (renameError) {
            setRenameError('');
          }
        }}
        onSave={() => void handleRenameSave()}
      />
    </PosPageFrame>
  );
}
