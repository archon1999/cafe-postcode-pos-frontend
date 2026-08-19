import { Box, Snackbar, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';

import { canCreateCashExpense, canViewCashShift, usePosSession } from 'modules/auth';
import {
  useCashierBuilderOrdersQuery,
  useCashierMenuQuery,
  useCashierPaymentOrderQuery,
  useSubmitCashierOrderMutation,
  cashierKeys,
} from 'modules/cashier/application';
import { cashierRepository } from 'modules/cashier/data-access';
import {
  aggregateCashierCartItemsByStation,
  getCashierOrderDisplayName,
  getCashierOrderItemsTotalQuantity,
  getCashierOrderMissingMarkingCount,
  getCurrentCashierBuilderOrder,
  getDefaultCashierMenuCategory,
  type CashierBuilderOrderChannel,
  type CashierMenuCategory,
  type CashierMenuItem,
  type CashierMenuItemGroup,
} from 'modules/cashier/domain';
import { requestEdgePrintDocuments } from 'modules/edge-printing/application';
import { getApiErrorMessage } from 'shared/api/errorMessage';
import { refreshTransportAndReload } from 'shared/api/transportResolver';
import { PosPageFrame } from 'shared/layout/PosPageFrame';
import { getPosCopy } from 'shared/locale/copy';
import { selectionsFromOrderModifiers, type PosModifierSelection } from 'shared/pos/modifiers';
import { isTemporaryBuilderId } from 'shared/pos/optimistic-builder-order';
import { buildServiceFeeRows } from 'shared/pos/service-fees';
import { useOptimisticBuilderOrder } from 'shared/pos/useOptimisticBuilderOrder';
import { useScannerInput } from 'shared/pos/useScannerInput';
import { addPosQuantities } from 'shared/pos/utils';
import {
  PosBuilderPageSkeleton,
  PosProductConfiguratorDialog,
  PosServicePriceDialog,
  PosSettingsMenu,
} from 'shared/ui/pos-primitives';
import type { PosCartItem } from 'shared/ui/pos-primitives/PosCartItemGroups';

import { CashierBuilderDesktopCart, CashierBuilderMobileCart } from './CashierBuilderCart';
import { CashierBuilderHeader } from './CashierBuilderHeader';
import { CashierBuilderMenuPanel } from './CashierBuilderMenuPanel';
import { CashierDeliveryDetailsDialog } from './CashierDeliveryDetailsDialog';
import { CashierItemGroupConfiguratorDialog } from './CashierItemGroupConfiguratorDialog';
import { CashierWeightDialog } from './CashierWeightDialog';
import { useCashierBuilderActions } from './useCashierBuilderActions';

const EMPTY_CATEGORIES: CashierMenuCategory[] = [];

function formatPercent(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');
}

function resolveBuilderChannel(value: string | null): CashierBuilderOrderChannel {
  return value === 'delivery' || value === 'takeaway' ? value : 'hall';
}

export function CashierBuilderPageContent() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { session, locale, setLocale, setSession, themeColor, setThemeColor, themeMode, setThemeMode } =
    usePosSession();
  const canViewShift = canViewCashShift(session?.user);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const copy = getPosCopy(locale);
  const editOrderId = searchParams.get('orderId');
  const [builderChannel, setBuilderChannel] = useState<CashierBuilderOrderChannel>(() =>
    resolveBuilderChannel(searchParams.get('channel')),
  );
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [kitchenNote, setKitchenNote] = useState('');
  const [settingsAnchor, setSettingsAnchor] = useState<HTMLElement | null>(null);
  const [selectedCartItemKey, setSelectedCartItemKey] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [scanToast, setScanToast] = useState('');
  const [configuringItem, setConfiguringItem] = useState<{
    item: CashierMenuItem;
    initialSelections?: PosModifierSelection[];
  } | null>(null);
  const [configuringGroup, setConfiguringGroup] = useState<CashierMenuItemGroup | null>(null);
  const [weighingItem, setWeighingItem] = useState<{
    item: CashierMenuItem;
    selections: PosModifierSelection[];
  } | null>(null);
  const [pricingService, setPricingService] = useState<{
    item: CashierMenuItem;
    selections: PosModifierSelection[];
  } | null>(null);
  const noteOrderIdRef = useRef<string | null>(null);

  const menuQuery = useCashierMenuQuery();
  const ordersQuery = useCashierBuilderOrdersQuery();
  const editOrderQuery = useCashierPaymentOrderQuery(editOrderId);
  const serverOrder = useMemo(
    () => editOrderQuery.data ?? getCurrentCashierBuilderOrder(ordersQuery.data, session?.user.id),
    [editOrderQuery.data, ordersQuery.data, session?.user.id],
  );
  const { currentOrder, addItem, addItems, removeItem, hasPendingOperations } = useOptimisticBuilderOrder({
    baseOrder: serverOrder,
    canonicalQueryKey: editOrderId ? cashierKeys.paymentOrder(editOrderId) : cashierKeys.builderOrders,
    canonicalQueryFn: async () =>
      editOrderId ? [await cashierRepository.getOrder(editOrderId)] : cashierRepository.getOpenOrders(),
    channel: builderChannel,
    createOrder: async (note) => {
      const response = await cashierRepository.createBuilderOrder({ channel: builderChannel, note });
      return response.id;
    },
    defaultServiceFeeEnabled: Boolean(session?.restaurantContext?.serviceFeeEnabled),
    defaultServiceFeePercent: Number(session?.restaurantContext?.serviceFeePercent ?? 0),
    defaultVatEnabled: Boolean(session?.restaurantContext?.vatEnabled),
    defaultVatPercent: session?.restaurantContext?.vatPercent ?? 0,
    removeOrderItem: (itemId) => cashierRepository.removeOrderItem(itemId),
    onOrderRemoved: () => {
      if (editOrderId) {
        void navigate('/cashier/open-checks', { replace: true });
      }
    },
    onPrintDocuments: (documentIds) => {
      requestEdgePrintDocuments(documentIds, (error) =>
        toast.error(error instanceof Error ? error.message : 'Oshxona chekini chiqarib bo‘lmadi'),
      );
    },
    resetKey: editOrderId ?? '',
    selectCurrentOrder: (orders) =>
      editOrderId
        ? orders.find((order) => order.id === editOrderId)
        : getCurrentCashierBuilderOrder(orders, session?.user.id),
    addOrderItem: (orderId, menuItem, note, selectedModifiers, manualPrice) =>
      cashierRepository.addOrderItem(orderId, menuItem.id, note, selectedModifiers, manualPrice),
    addOrderItems: (orderId, items) =>
      cashierRepository.addOrderItems(
        orderId,
        items.map((item) => ({
          catalogItemId: item.menuItem.id,
          quantity: item.quantity,
          note: item.note,
          selectedModifiers: item.selectedModifiers,
          manualPrice: item.manualPrice,
        })),
      ),
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

  const submitOrderMutation = useSubmitCashierOrderMutation({
    orderId: currentOrder?.id,
    onPrintError: (error) => toast.error(error instanceof Error ? error.message : 'Oshxona chekini chiqarib bo‘lmadi'),
    onSuccess: () => {
      setKitchenNote('');
      setCartOpen(false);
    },
  });

  useScannerInput({
    enabled: true,
    onScan: async (rawCode) => {
      try {
        const quantityBeforeScan = getCashierOrderItemsTotalQuantity(currentOrder?.items);
        const orderId =
          currentOrder?.id ??
          (await cashierRepository.createBuilderOrder({ channel: builderChannel, note: kitchenNote })).id;
        const { order: updatedOrder, kitchenPrintDocuments } = await cashierRepository.scanOrderMarking(
          orderId,
          rawCode,
          'add',
        );
        requestEdgePrintDocuments(kitchenPrintDocuments, (error) =>
          toast.error(error instanceof Error ? error.message : 'Oshxona chekini chiqarib bo‘lmadi'),
        );
        await ordersQuery.refetch();
        const quantityAfterScan = getCashierOrderItemsTotalQuantity(updatedOrder.items);
        setScanToast(
          quantityAfterScan > quantityBeforeScan ? 'Mahsulot skaner orqali qo‘shildi.' : 'Markirovka biriktirildi.',
        );
      } catch (error) {
        setScanToast(getApiErrorMessage(error, 'Bunaqa mahsulot yo‘q yoki markirovka kodi yaroqsiz.'));
      }
    },
  });

  const categories = menuQuery.data ?? EMPTY_CATEGORIES;
  const defaultCategory = useMemo(() => getDefaultCashierMenuCategory(categories), [categories]);
  const selectedCategory = categories.find((category) => category.id === selectedCategoryId) ?? defaultCategory;
  const groupedOrderItems = useMemo(
    () => aggregateCashierCartItemsByStation(currentOrder?.items, copy.menu),
    [copy.menu, currentOrder?.items],
  );
  const menuItemById = useMemo(
    () => new Map(categories.flatMap((category) => category.items.map((menuItem) => [menuItem.id, menuItem] as const))),
    [categories],
  );
  const menuItemMeta = useMemo(() => {
    const countMap = new Map<string, number>();
    const latestItemMap = new Map<string, string>();

    for (const item of currentOrder?.items ?? []) {
      if (item.status === 'cancelled') {
        continue;
      }

      const count = Number(item.quantity ?? 0);
      countMap.set(item.catalogItem, addPosQuantities(countMap.get(item.catalogItem), count));
      latestItemMap.set(item.catalogItem, item.id);
    }

    return { countMap, latestItemMap };
  }, [currentOrder?.items]);
  const requestAddItem = (menuItem: CashierMenuItem, sourceItem?: PosCartItem) => {
    if (menuItem.modifierGroups?.length) {
      setConfiguringItem({
        item: menuItem,
        initialSelections: sourceItem
          ? selectionsFromOrderModifiers(menuItem.modifierGroups, sourceItem.modifiers)
          : undefined,
      });
      return;
    }
    if (menuItem.itemType === 'service') {
      setPricingService({ item: menuItem, selections: [] });
      return;
    }
    if (menuItem.saleUnit === 'kg') {
      setWeighingItem({ item: menuItem, selections: [] });
      return;
    }
    addItem(menuItem, kitchenNote);
  };
  const categoryTabs = useMemo(
    () =>
      categories.map((category) => ({
        value: category.id,
        label: category.name,
        count: category.items.filter((menuItem) => (menuItemMeta.countMap.get(menuItem.id) ?? 0) > 0).length,
      })),
    [categories, menuItemMeta.countMap],
  );
  const serviceFeePercent = Number(currentOrder?.serviceFeePercent ?? 0);
  const serviceFeeAmount = Number(currentOrder?.serviceFee ?? 0);
  const serviceFeeEnabled = Boolean(currentOrder?.serviceFeeEnabled);
  const shouldShowServiceFee = serviceFeeEnabled && (serviceFeePercent > 0 || serviceFeeAmount > 0);
  const serviceFeeLabel = `${copy.serviceFee} (${serviceFeePercent}%)`;
  const serviceFeeRows = buildServiceFeeRows(currentOrder?.serviceFeeComponents, {
    restaurant: copy.restaurantServiceFee,
    hall: copy.hallServiceFee,
    table: copy.tableServiceFee,
  });
  const vatEnabled = Boolean(currentOrder?.vatEnabled);
  const vatPercent = Number(currentOrder?.vatPercent ?? 0);
  const vatAmount = Number(currentOrder?.vatAmount ?? 0);
  const shouldShowVat = vatEnabled && vatPercent > 0;
  const vatLabel = `${copy.vat} (${formatPercent(vatPercent)}%)`;
  const markingCheckEnabled = Boolean(session?.restaurantContext?.markingCheckEnabled);
  const missingMarkingCount = useMemo(
    () => getCashierOrderMissingMarkingCount(currentOrder?.items),
    [currentOrder?.items],
  );
  const hasMissingMarkings = markingCheckEnabled && missingMarkingCount > 0;
  const missingMarkingMessage = `${missingMarkingCount} ta markirovka skanerlanmagan`;
  const builderActions = useCashierBuilderActions({
    builderChannel,
    currentOrder,
    editOrderId,
    errorFallback: copy.itemSyncFailed,
    hasMissingMarkings,
    hasPendingOperations,
    missingMarkingMessage,
    orderNote: kitchenNote,
    serverOrder,
    submitOrder: () => submitOrderMutation.mutateAsync(),
    submitPending: submitOrderMutation.isPending,
    closeCart: () => setCartOpen(false),
    navigateToPayment: (orderId) => void navigate(`/cashier/payment?orderId=${orderId}`),
    refetchEditOrder: () => editOrderQuery.refetch(),
    refetchOrders: () => ordersQuery.refetch(),
    reportMessage: setScanToast,
    setBuilderChannel,
    clearSelectedCartItem: () => setSelectedCartItemKey(null),
  });
  const isSubmitDisabled =
    !currentOrder ||
    submitOrderMutation.isPending ||
    hasPendingOperations ||
    hasMissingMarkings ||
    builderActions.deliveryDetailsSaving;
  const channelSwitchDisabled =
    hasPendingOperations ||
    submitOrderMutation.isPending ||
    builderActions.deliveryDetailsSaving ||
    builderActions.channelSwitchSaving;

  useEffect(() => {
    const channelFromQuery = resolveBuilderChannel(searchParams.get('channel'));
    setBuilderChannel((current) => (current === channelFromQuery ? current : channelFromQuery));
  }, [searchParams]);

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

  const currentOrderLabel = currentOrder
    ? isTemporaryBuilderId(currentOrder.id) || /^L-[0-9a-f]{6}$/i.test(currentOrder.displayName?.trim() ?? '')
      ? copy.orderCreating
      : getCashierOrderDisplayName(currentOrder)
    : '#0';

  return (
    <PosPageFrame
      header={
        <CashierBuilderHeader
          categoryId={selectedCategory?.id ?? ''}
          categoryTabs={categoryTabs}
          isMobile={isMobile}
          onCategoryChange={setSelectedCategoryId}
          onMenuOpen={() => navigate(`/menu/catalog?source=cashier&channel=${builderChannel}`)}
          onRefresh={() => void refreshTransportAndReload()}
          onSettingsOpen={(event) => setSettingsAnchor(event.currentTarget)}
          onLock={() => navigate('/lock-screen')}
        />
      }>
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            md: 'minmax(0, 1fr) clamp(320px, 34vw, 360px)',
            xl: 'minmax(0, 1fr) clamp(380px, 24vw, 430px)',
          },
          gap: { xs: 1.5, md: 1.6, xl: 2.4 },
        }}>
        <CashierBuilderMenuPanel
          category={selectedCategory}
          groups={groupedOrderItems}
          isMobile={isMobile}
          locale={locale}
          menuLabel={copy.menu}
          itemCounts={menuItemMeta.countMap}
          latestItemIds={menuItemMeta.latestItemMap}
          total={currentOrder?.total}
          billsLabel={copy.bills}
          onAdd={requestAddItem}
          onOpenGroup={setConfiguringGroup}
          onCartOpen={() => setCartOpen(true)}
          onRemove={removeItem}
        />

        <CashierBuilderDesktopCart
          channel={builderChannel}
          channelSwitchDisabled={channelSwitchDisabled}
          copy={copy}
          currentOrderLabel={currentOrderLabel}
          groups={groupedOrderItems}
          isSubmitDisabled={isSubmitDisabled}
          isSubmitting={submitOrderMutation.isPending}
          kitchenNote={kitchenNote}
          locale={locale}
          menuItems={menuItemById}
          missingMarkingMessage={missingMarkingMessage}
          selectedItemKey={selectedCartItemKey}
          serviceFee={currentOrder?.serviceFee}
          serviceFeeLabel={serviceFeeLabel}
          serviceFeeRows={serviceFeeRows}
          showMissingMarkings={hasMissingMarkings}
          showServiceFee={shouldShowServiceFee}
          showVat={shouldShowVat}
          subtotal={currentOrder?.subtotal}
          total={currentOrder?.total}
          userName={session?.user.fullName}
          vatAmount={vatAmount}
          vatLabel={vatLabel}
          onAdd={requestAddItem}
          onChannelChange={(channel) => void builderActions.changeChannel(channel)}
          onCheckout={() => void builderActions.runOrderAction('checkout')}
          onKitchenNoteChange={setKitchenNote}
          onRemove={removeItem}
          onSelect={(key) => setSelectedCartItemKey((current) => (current === key ? null : key))}
          onSendOrder={() => void builderActions.runOrderAction('submit')}
        />
      </Box>

      <CashierBuilderMobileCart
        open={isMobile && cartOpen}
        channel={builderChannel}
        channelSwitchDisabled={channelSwitchDisabled}
        copy={copy}
        currentOrderLabel={currentOrderLabel}
        groups={groupedOrderItems}
        isSubmitDisabled={isSubmitDisabled}
        isSubmitting={submitOrderMutation.isPending}
        kitchenNote={kitchenNote}
        locale={locale}
        menuItems={menuItemById}
        missingMarkingMessage={missingMarkingMessage}
        selectedItemKey={selectedCartItemKey}
        serviceFee={currentOrder?.serviceFee}
        serviceFeeLabel={serviceFeeLabel}
        serviceFeeRows={serviceFeeRows}
        showMissingMarkings={hasMissingMarkings}
        showServiceFee={shouldShowServiceFee}
        showVat={shouldShowVat}
        subtotal={currentOrder?.subtotal}
        total={currentOrder?.total}
        userName={session?.user.fullName}
        vatAmount={vatAmount}
        vatLabel={vatLabel}
        onAdd={requestAddItem}
        onChannelChange={(channel) => void builderActions.changeChannel(channel)}
        onCheckout={() => void builderActions.runOrderAction('checkout')}
        onClose={() => setCartOpen(false)}
        onKitchenNoteChange={setKitchenNote}
        onRemove={removeItem}
        onSelect={(key) => setSelectedCartItemKey((current) => (current === key ? null : key))}
        onSendOrder={() => void builderActions.runOrderAction('submit')}
      />

      <CashierDeliveryDetailsDialog
        open={builderActions.deliveryDialogOpen}
        saving={builderActions.deliveryDetailsSaving}
        attempted={builderActions.deliveryDetailsAttempted}
        phone={builderActions.deliveryPhone}
        address={builderActions.deliveryAddress}
        isPhoneValid={builderActions.isDeliveryPhoneValid}
        isAddressValid={builderActions.isDeliveryAddressValid}
        pendingAction={builderActions.pendingDeliveryAction}
        copy={copy}
        onPhoneChange={builderActions.setDeliveryPhone}
        onAddressChange={builderActions.setDeliveryAddress}
        onClose={builderActions.closeDeliveryDialog}
        onConfirm={() => void builderActions.confirmDeliveryDetails()}
      />

      {configuringItem ? (
        <PosProductConfiguratorDialog
          item={configuringItem?.item ?? null}
          initialSelections={configuringItem?.initialSelections}
          locale={locale}
          copy={{
            addToOrder: copy.modifierAddToOrder,
            free: copy.modifierFree,
            optional: copy.modifierOptional,
            required: copy.modifierRequired,
            selectOne: copy.modifierSelectOne,
            selectUpTo: copy.modifierSelectUpTo,
            selectedCount: copy.selectedCount,
          }}
          onClose={() => setConfiguringItem(null)}
          onConfirm={(menuItem, selections) => {
            if (menuItem.itemType === 'service') {
              setPricingService({ item: menuItem, selections });
            } else if (menuItem.saleUnit === 'kg') {
              setWeighingItem({ item: menuItem, selections });
            } else {
              addItem(menuItem, kitchenNote, selections);
            }
            setConfiguringItem(null);
          }}
        />
      ) : null}

      <CashierItemGroupConfiguratorDialog
        group={configuringGroup}
        locale={locale}
        copy={{
          addToOrder: copy.modifierAddToOrder,
          free: copy.modifierFree,
          optional: copy.modifierOptional,
          required: copy.modifierRequired,
          selectOne: copy.modifierSelectOne,
          selectUpTo: copy.modifierSelectUpTo,
          selectedCount: copy.selectedCount,
        }}
        onClose={() => setConfiguringGroup(null)}
        onConfirm={(lines) => {
          addItems(
            lines.map((line) => ({
              menuItem: line.item,
              quantity: line.quantity,
              note: kitchenNote,
              selectedModifiers: line.selections,
            })),
          );
          setConfiguringGroup(null);
        }}
      />

      {weighingItem ? (
        <CashierWeightDialog
          item={weighingItem.item}
          selections={weighingItem.selections}
          locale={locale}
          onClose={() => setWeighingItem(null)}
          onConfirm={(quantity) => {
            addItems([
              {
                menuItem: weighingItem.item,
                quantity,
                note: kitchenNote,
                selectedModifiers: weighingItem.selections,
              },
            ]);
            setWeighingItem(null);
          }}
        />
      ) : null}

      {pricingService ? (
        <PosServicePriceDialog
          item={pricingService.item}
          locale={locale}
          onClose={() => setPricingService(null)}
          onConfirm={(manualPrice) => {
            addItem(pricingService.item, kitchenNote, pricingService.selections, manualPrice);
            setPricingService(null);
          }}
        />
      ) : null}

      <PosSettingsMenu
        anchorEl={settingsAnchor}
        locale={locale}
        onClose={() => setSettingsAnchor(null)}
        onLocaleChange={setLocale}
        onRefresh={isMobile ? () => window.location.reload() : undefined}
        onShift={canViewShift ? () => navigate('/cashier/shift?next=/cashier/builder') : undefined}
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
      <Snackbar
        open={Boolean(scanToast)}
        autoHideDuration={2800}
        message={scanToast}
        onClose={() => setScanToast('')}
      />
    </PosPageFrame>
  );
}
