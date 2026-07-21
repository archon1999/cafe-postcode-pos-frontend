import { Box, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';

import {
  canAccessCashierPayments,
  canAccessTableSessionMenu,
  canAccessTakeawayBuilder,
  usePosSession,
} from 'modules/auth';
import { enqueueEdgePrintDocuments } from 'modules/edge-printing/application';
import {
  useCurrentWaiterOrder,
  useCurrentWaiterTakeawayOrder,
  useSubmitWaiterOrderMutation,
  useWaiterMenuQuery,
  useWaiterTableSessionQuery,
  waiterKeys,
} from 'modules/waiter/application';
import { waiterRepository } from 'modules/waiter/data-access';
import {
  aggregateWaiterCartItemsByStation,
  formatWaiterOrderLabel,
  getDefaultWaiterMenuCategory,
  getWaiterOrderItemMeta,
} from 'modules/waiter/domain';
import { refreshTransportAndReload } from 'shared/api/transportResolver';
import { PosPageFrame } from 'shared/layout/PosPageFrame';
import { getPosCopy } from 'shared/locale/copy';
import { useOptimisticBuilderOrder } from 'shared/pos/useOptimisticBuilderOrder';
import { PosBuilderPageSkeleton, PosSettingsMenu } from 'shared/ui/pos-primitives';

import { TableSessionDesktopCart } from './TableSessionDesktopCart';
import { TableSessionMobileCart } from './TableSessionMobileCart';
import { TableSessionHeader, TableSessionMenuPanel } from './TableSessionPageChrome';

export type TableSessionPageContentProps = {
  sessionId: string | null;
  mode: 'hall' | 'takeaway';
  source?: string | null;
};

function formatPercent(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');
}

export function TableSessionPageContent({ sessionId, mode, source: _source = null }: TableSessionPageContentProps) {
  const navigate = useNavigate();
  const { session, locale, setLocale, setSession, themeColor, setThemeColor, themeMode, setThemeMode } =
    usePosSession();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isTakeawayMode = mode === 'takeaway';

  const copy = getPosCopy(locale);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [kitchenNote, setKitchenNote] = useState('');
  const [settingsAnchor, setSettingsAnchor] = useState<HTMLElement | null>(null);
  const [orderSent, setOrderSent] = useState(false);
  const [selectedCartItemKey, setSelectedCartItemKey] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const noteOrderIdRef = useRef<string | null>(null);
  const canViewMenu = isTakeawayMode
    ? canAccessTakeawayBuilder(session?.user)
    : canAccessTableSessionMenu(session?.user);

  const sessionQuery = useWaiterTableSessionQuery(sessionId);
  const menuQuery = useWaiterMenuQuery({ enabled: canViewMenu });
  const hallOrderQuery = useCurrentWaiterOrder(sessionId);
  const takeawayOrderQuery = useCurrentWaiterTakeawayOrder(session?.user.id);
  const serverOrder = isTakeawayMode ? takeawayOrderQuery.currentOrder : hallOrderQuery.currentOrder;
  const currentOperatorName = session?.user.fullName ?? '';
  const { currentOrder, addItem, removeItem, hasPendingOperations } = useOptimisticBuilderOrder({
    baseOrder: serverOrder,
    canonicalQueryKey: waiterKeys.orders,
    canonicalQueryFn: () => waiterRepository.getOrders(),
    channel: isTakeawayMode ? 'takeaway' : 'hall',
    createOrder: async (note) => {
      const response = isTakeawayMode
        ? await waiterRepository.createTakeawayOrder(note)
        : await waiterRepository.createOrder(sessionId as string, note);
      return response.id;
    },
    defaultServiceFeeEnabled: Boolean(session?.restaurantContext?.serviceFeeEnabled),
    defaultServiceFeePercent: Number(session?.restaurantContext?.serviceFeePercent ?? 0),
    defaultVatEnabled: Boolean(session?.restaurantContext?.vatEnabled),
    defaultVatPercent: session?.restaurantContext?.vatPercent ?? 0,
    removeOrderItem: (itemId) => waiterRepository.removeOrderItem(itemId),
    onPrintDocuments: (documentIds) => {
      void enqueueEdgePrintDocuments(documentIds).then(({ errors }) => {
        errors.forEach((error) =>
          toast.error(error instanceof Error ? error.message : 'Oshxona chekini chiqarib bo‘lmadi'),
        );
      });
    },
    selectCurrentOrder: (orders) =>
      isTakeawayMode
        ? orders.find(
            (order) =>
              !order.tableSession &&
              order.channel === 'takeaway' &&
              order.status === 'open' &&
              order.openedBy === session?.user.id,
          )
        : orders.find((order) => order.tableSession === sessionId && !['closed', 'cancelled'].includes(order.status)),
    addOrderItem: (orderId, menuItem, note) => waiterRepository.addOrderItem(orderId, menuItem.id, note),
    syncErrorMessage: copy.itemSyncFailed,
  });

  useEffect(() => {
    const orderId = currentOrder?.id ?? null;
    if (!orderId || noteOrderIdRef.current === orderId) {
      return;
    }
    noteOrderIdRef.current = orderId;
    setKitchenNote(currentOrder?.note ?? '');
  }, [currentOrder?.id, currentOrder?.note]);

  const serviceFeePercent = Number(
    currentOrder?.serviceFeePercent ?? session?.restaurantContext?.serviceFeePercent ?? 0,
  );
  const serviceFeeAmount = Number(currentOrder?.serviceFee ?? 0);
  const serviceFeeEnabled = Boolean(currentOrder?.serviceFeeEnabled ?? session?.restaurantContext?.serviceFeeEnabled);
  const shouldShowServiceFee = serviceFeeEnabled && (serviceFeePercent > 0 || serviceFeeAmount > 0);
  const serviceFeeLabel = `${copy.serviceFee} (${serviceFeePercent}%)`;
  const vatEnabled = Boolean(currentOrder?.vatEnabled);
  const vatPercent = Number(currentOrder?.vatPercent ?? 0);
  const vatAmount = Number(currentOrder?.vatAmount ?? 0);
  const shouldShowVat = vatEnabled && vatPercent > 0;
  const vatLabel = `${copy.vat} (${formatPercent(vatPercent)}%)`;
  const orderModeMeta = isTakeawayMode ? `${1} ${copy.guests}` : `${sessionQuery.data?.guestCount ?? 0} ${copy.guests}`;
  const tableNumberLabel = sessionQuery.data?.tableNumber
    ? String(sessionQuery.data.tableNumber)
    : (sessionQuery.data?.tableName?.match(/\d+/)?.[0] ?? '0');
  const submitOrderMutation = useSubmitWaiterOrderMutation({
    orderId: currentOrder?.id,
    sessionId,
    orderNote: kitchenNote,
    onPrintError: (error) => toast.error(error instanceof Error ? error.message : 'Oshxona chekini chiqarib bo‘lmadi'),
    onSuccess: () => {
      setOrderSent(true);
      setCartOpen(false);
    },
  });

  const categories = useMemo(() => menuQuery.data ?? [], [menuQuery.data]);
  const defaultCategory = useMemo(() => getDefaultWaiterMenuCategory(categories), [categories]);
  const selectedCategory = categories.find((category) => category.id === selectedCategoryId) ?? defaultCategory;
  const groupedOrderItems = useMemo(
    () => aggregateWaiterCartItemsByStation(currentOrder?.items, copy.menu),
    [copy.menu, currentOrder?.items],
  );
  const menuItemById = useMemo(
    () => new Map(categories.flatMap((category) => category.items.map((menuItem) => [menuItem.id, menuItem] as const))),
    [categories],
  );
  const menuItemMeta = useMemo(() => getWaiterOrderItemMeta(currentOrder?.items), [currentOrder?.items]);
  const categoryTabs = useMemo(
    () =>
      categories.map((category) => ({
        value: category.id,
        label: category.name,
        count: category.items.reduce((total, menuItem) => total + (menuItemMeta.countMap.get(menuItem.id) ?? 0), 0),
      })),
    [categories, menuItemMeta.countMap],
  );
  const canTakePayment = canAccessCashierPayments(session?.user);
  const isSubmitDisabled = !currentOrder || submitOrderMutation.isPending || hasPendingOperations;

  const handleTakeawayCheckout = async () => {
    if (!currentOrder || submitOrderMutation.isPending || hasPendingOperations) {
      return;
    }

    if (!canTakePayment) {
      submitOrderMutation.mutate();
      return;
    }

    await submitOrderMutation.mutateAsync();
    setCartOpen(false);
    void navigate(`/cashier/payment?orderId=${currentOrder.id}`);
  };

  useEffect(() => {
    if (!selectedCartItemKey) {
      return;
    }

    const itemStillExists = groupedOrderItems.some(([, items]) =>
      items.some((item) => item.key === selectedCartItemKey),
    );
    if (!itemStillExists) {
      setSelectedCartItemKey(null);
    }
  }, [groupedOrderItems, selectedCartItemKey]);

  const isInitialLoading = menuQuery.isLoading && !menuQuery.data;

  if (isInitialLoading) {
    return <PosBuilderPageSkeleton mobile={isMobile} />;
  }

  return (
    <PosPageFrame
      header={
        <TableSessionHeader
          categoryTabs={categoryTabs}
          isMobile={isMobile}
          selectedCategoryId={selectedCategory?.id ?? ''}
          sessionId={sessionId}
          showCatalogAction={!isTakeawayMode}
          onCategoryChange={setSelectedCategoryId}
          onCatalog={() => navigate(`/menu/catalog?source=waiter&sessionId=${encodeURIComponent(sessionId ?? '')}`)}
          onLock={() => navigate('/lock-screen')}
          onRefresh={() => void refreshTransportAndReload()}
          onSettings={(event) => setSettingsAnchor(event.currentTarget)}
        />
      }>
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 350px' },
          gap: { xs: 2, md: 2.5 },
        }}>
        <TableSessionMenuPanel
          copy={copy}
          currentTotal={currentOrder?.total}
          itemCount={groupedOrderItems.reduce((sum, [, items]) => sum + items.length, 0)}
          latestItemMap={menuItemMeta.latestItemMap}
          locale={locale}
          selectedCategory={selectedCategory}
          selectedCountMap={menuItemMeta.countMap}
          showMobileSummary={isMobile}
          onAdd={(menuItem) => addItem(menuItem, kitchenNote)}
          onOpenCart={() => setCartOpen(true)}
          onRemove={removeItem}
        />

        <TableSessionDesktopCart
          avatarLabel={isTakeawayMode ? 'TG' : tableNumberLabel}
          canTakePayment={canTakePayment}
          channel={currentOrder?.channel ?? mode}
          copy={copy}
          groups={groupedOrderItems}
          isSubmitDisabled={isSubmitDisabled}
          isSubmitting={submitOrderMutation.isPending}
          isTakeawayMode={isTakeawayMode}
          kitchenNote={kitchenNote}
          locale={locale}
          menuItems={menuItemById}
          operatorName={
            isTakeawayMode ? currentOperatorName : (sessionQuery.data?.assignedWaiterName ?? currentOperatorName)
          }
          orderLabel={formatWaiterOrderLabel(currentOrder)}
          orderModeMeta={orderModeMeta}
          orderSent={orderSent}
          selectedItemKey={selectedCartItemKey}
          serviceFee={currentOrder?.serviceFee}
          serviceFeeLabel={serviceFeeLabel}
          showServiceFee={shouldShowServiceFee}
          showVat={shouldShowVat}
          subtotal={currentOrder?.subtotal}
          total={currentOrder?.total}
          vatAmount={vatAmount}
          vatLabel={vatLabel}
          onAdd={(menuItem) => addItem(menuItem, kitchenNote)}
          onCheckout={() => void handleTakeawayCheckout()}
          onKitchenNoteChange={(value) => {
            setOrderSent(false);
            setKitchenNote(value);
          }}
          onRemove={removeItem}
          onSelect={(key) => setSelectedCartItemKey((current) => (current === key ? null : key))}
          onSubmit={() => submitOrderMutation.mutate()}
        />
      </Box>

      <TableSessionMobileCart
        open={isMobile && cartOpen}
        avatarLabel=""
        canTakePayment={canTakePayment}
        channel={currentOrder?.channel ?? mode}
        copy={copy}
        groups={groupedOrderItems}
        isSubmitDisabled={isSubmitDisabled}
        isSubmitting={submitOrderMutation.isPending}
        isTakeawayMode={isTakeawayMode}
        kitchenNote={kitchenNote}
        locale={locale}
        menuItems={menuItemById}
        operatorName=""
        orderLabel={formatWaiterOrderLabel(currentOrder)}
        orderModeMeta=""
        orderSent={orderSent}
        selectedItemKey={selectedCartItemKey}
        serviceFee={currentOrder?.serviceFee}
        serviceFeeLabel={serviceFeeLabel}
        showServiceFee={shouldShowServiceFee}
        showVat={shouldShowVat}
        subtotal={currentOrder?.subtotal}
        total={currentOrder?.total}
        vatAmount={vatAmount}
        vatLabel={vatLabel}
        onAdd={(menuItem) => addItem(menuItem, kitchenNote)}
        onCheckout={() => void handleTakeawayCheckout()}
        onClose={() => setCartOpen(false)}
        onKitchenNoteChange={(value) => {
          setOrderSent(false);
          setKitchenNote(value);
        }}
        onRemove={removeItem}
        onSelect={(key) => setSelectedCartItemKey((current) => (current === key ? null : key))}
        onSubmit={() => submitOrderMutation.mutate()}
      />

      <PosSettingsMenu
        anchorEl={settingsAnchor}
        locale={locale}
        onClose={() => setSettingsAnchor(null)}
        onLocaleChange={setLocale}
        onRefresh={isMobile ? () => window.location.reload() : undefined}
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
