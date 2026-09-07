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
import { requestEdgePrintDocuments } from 'modules/edge-printing/application';
import {
  useCurrentWaiterOrder,
  useCurrentWaiterTakeawayOrder,
  usePrintWaiterPrecheckMutation,
  useSubmitWaiterOrderMutation,
  useUpdateWaiterOrderItemNoteMutation,
  useWaiterMenuQuery,
  useWaiterTableSessionQuery,
  waiterKeys,
} from 'modules/waiter/application';
import { waiterRepository } from 'modules/waiter/data-access';
import {
  aggregateWaiterCartItemsByStation,
  getDefaultWaiterMenuCategory,
  getWaiterOrderItemMeta,
  type WaiterMenuItem,
  type WaiterMenuItemGroup,
} from 'modules/waiter/domain';
import { getApiErrorMessage } from 'shared/api/errorMessage';
import { refreshTransportAndReload } from 'shared/api/transportResolver';
import { PosPageFrame } from 'shared/layout/PosPageFrame';
import { getPosCopy } from 'shared/locale/copy';
import { selectionsFromOrderModifiers, type PosModifierSelection } from 'shared/pos/modifiers';
import { getPosTableNumberLabel, getPosZoneContextLabel } from 'shared/pos/orderLocation';
import { buildServiceFeeRows, type PosServiceFeeComponent } from 'shared/pos/service-fees';
import { useOptimisticBuilderOrder } from 'shared/pos/useOptimisticBuilderOrder';
import {
  PosBuilderPageSkeleton,
  PosBuilderHeader,
  PosBuilderMenuPanel,
  PosItemGroupConfiguratorDialog,
  PosItemNoteDialog,
  PosProductConfiguratorDialog,
  PosServicePriceDialog,
  PosSettingsMenu,
  PosWeightedItemDialog,
} from 'shared/ui/pos-primitives';
import type { PosCartItem } from 'shared/ui/pos-primitives/PosCartItemGroups';
import { useInventoryCancellation } from 'shared/ui/pos-primitives/useInventoryCancellation';

import { TableSessionDesktopCart } from './TableSessionDesktopCart';
import { TableSessionMobileCart } from './TableSessionMobileCart';

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
  const [editingItemNote, setEditingItemNote] = useState<PosCartItem | null>(null);
  const [addingItemWithNote, setAddingItemWithNote] = useState<WaiterMenuItem | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [configuringItem, setConfiguringItem] = useState<{
    item: WaiterMenuItem;
    initialNote?: string;
    initialSelections?: PosModifierSelection[];
  } | null>(null);
  const [configuringGroup, setConfiguringGroup] = useState<WaiterMenuItemGroup | null>(null);
  const [weighingItem, setWeighingItem] = useState<{
    item: WaiterMenuItem;
    initialNote?: string;
    selections: PosModifierSelection[];
  } | null>(null);
  const [pricingService, setPricingService] = useState<{
    item: WaiterMenuItem;
    initialNote?: string;
    selections: PosModifierSelection[];
  } | null>(null);
  const noteOrderIdRef = useRef<string | null>(null);
  const canViewMenu = isTakeawayMode
    ? canAccessTakeawayBuilder(session?.user)
    : canAccessTableSessionMenu(session?.user);

  const sessionQuery = useWaiterTableSessionQuery(sessionId);
  useEffect(() => {
    if (
      !isTakeawayMode &&
      (sessionQuery.data === null || ['closed', 'merged'].includes(sessionQuery.data?.status ?? ''))
    ) {
      void navigate('/waiter/halls', { replace: true });
    }
  }, [isTakeawayMode, navigate, sessionQuery.data]);
  const menuQuery = useWaiterMenuQuery({ enabled: canViewMenu });
  const hallOrderQuery = useCurrentWaiterOrder(sessionId);
  const takeawayOrderQuery = useCurrentWaiterTakeawayOrder(session?.user.id);
  const serverOrder = isTakeawayMode ? takeawayOrderQuery.currentOrder : hallOrderQuery.currentOrder;
  const restaurantServiceFeeComponents: PosServiceFeeComponent[] = session?.restaurantContext?.serviceFeeEnabled
    ? [
        {
          scope: 'restaurant',
          mode: session.restaurantContext.serviceFeeMode ?? 'percentage',
          percent: session.restaurantContext.serviceFeePercent ?? 0,
          hourlyRate: session.restaurantContext.serviceFeeHourlyRate ?? 0,
        },
      ]
    : [];
  const defaultServiceFeeComponents = isTakeawayMode
    ? restaurantServiceFeeComponents
    : (sessionQuery.data?.serviceFeeComponents ?? []);
  const currentOperatorName = session?.user.fullName ?? '';
  const {
    currentOrder,
    addItem,
    addItems,
    removeItem: removeItemDirect,
    hasPendingOperations,
  } = useOptimisticBuilderOrder({
    baseOrder: serverOrder,
    canonicalQueryKey: waiterKeys.orders,
    canonicalQueryFn: () => waiterRepository.getOrders(),
    channel: isTakeawayMode ? 'takeaway' : 'hall',
    createOrder: async () => {
      const response = isTakeawayMode
        ? await waiterRepository.createTakeawayOrder(kitchenNote)
        : await waiterRepository.createOrder(sessionId as string, kitchenNote);
      return response.id;
    },
    defaultServiceFeeEnabled: defaultServiceFeeComponents.length > 0,
    defaultServiceFeePercent: defaultServiceFeeComponents.reduce(
      (sum, component) => sum + Number(component.percent ?? 0),
      0,
    ),
    defaultServiceFeeComponents,
    defaultServiceFeeStartedAt: sessionQuery.data?.openedAt,
    defaultVatEnabled: Boolean(session?.restaurantContext?.vatEnabled),
    defaultVatPercent: session?.restaurantContext?.vatPercent ?? 0,
    removeOrderItem: (itemId, disposition) => waiterRepository.removeOrderItem(itemId, disposition),
    onOrderRemoved: (removedOrder) => {
      if (!isTakeawayMode && removedOrder && removedOrder.status !== 'open') {
        void navigate('/waiter/halls', { replace: true });
      }
    },
    onPrintDocuments: (documentIds) => {
      requestEdgePrintDocuments(documentIds, (error) =>
        toast.error(error instanceof Error ? error.message : 'Oshxona chekini chiqarib bo‘lmadi'),
      );
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
    addOrderItem: (orderId, menuItem, note, selectedModifiers, manualPrice) =>
      waiterRepository.addOrderItem(orderId, menuItem.id, note, selectedModifiers, manualPrice),
    addOrderItems: (orderId, items) =>
      waiterRepository.addOrderItems(
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
  const { removeItem, inventoryCancellationDialog } = useInventoryCancellation(
    currentOrder?.items,
    removeItemDirect,
    locale,
  );
  const updateItemNoteMutation = useUpdateWaiterOrderItemNoteMutation({
    sessionId,
    onSuccess: () => {
      setEditingItemNote(null);
      setSelectedCartItemKey(null);
    },
    onError: (error) => toast.error(getApiErrorMessage(error, copy.itemSyncFailed)),
  });

  useEffect(() => {
    const orderId = currentOrder?.id ?? null;
    if (!orderId || noteOrderIdRef.current === orderId) {
      return;
    }
    noteOrderIdRef.current = orderId;
    setKitchenNote(currentOrder?.note ?? '');
  }, [currentOrder?.id, currentOrder?.note]);

  const activeServiceFeeComponents = currentOrder?.serviceFeeComponents ?? defaultServiceFeeComponents;
  const serviceFeePercent = Number(
    currentOrder?.serviceFeePercent ??
      activeServiceFeeComponents.reduce((sum, component) => sum + Number(component.percent ?? 0), 0),
  );
  const serviceFeeAmount = Number(currentOrder?.serviceFee ?? 0);
  const serviceFeeEnabled = Boolean(currentOrder?.serviceFeeEnabled ?? activeServiceFeeComponents.length > 0);
  const shouldShowServiceFee = serviceFeeEnabled && (serviceFeePercent > 0 || serviceFeeAmount > 0);
  const serviceFeeLabel = serviceFeePercent > 0 ? `${copy.serviceFee} (${serviceFeePercent}%)` : copy.serviceFee;
  const serviceFeeRows = buildServiceFeeRows(activeServiceFeeComponents, {
    restaurant: copy.restaurantServiceFee,
    hall: copy.hallServiceFee,
    table: copy.tableServiceFee,
    hourly: copy.hourlyServiceFee,
  });
  const vatEnabled = Boolean(currentOrder?.vatEnabled);
  const vatPercent = Number(currentOrder?.vatPercent ?? 0);
  const vatAmount = Number(currentOrder?.vatAmount ?? 0);
  const shouldShowVat = vatEnabled && vatPercent > 0;
  const vatLabel = `${copy.vat} (${formatPercent(vatPercent)}%)`;
  const orderModeMeta = isTakeawayMode ? `${1} ${copy.guests}` : `${sessionQuery.data?.guestCount ?? 0} ${copy.guests}`;
  const tableNumberLabel = getPosTableNumberLabel(sessionQuery.data ?? undefined);
  const tableZoneLabel = isTakeawayMode ? '' : getPosZoneContextLabel(sessionQuery.data ?? undefined);
  const tableHallLabel = isTakeawayMode ? '' : String(sessionQuery.data?.hallName ?? '').trim();
  const submitOrderMutation = useSubmitWaiterOrderMutation({
    orderId: currentOrder?.id,
    sessionId,
    orderNote: kitchenNote,
    onPrintError: (error) => toast.error(error instanceof Error ? error.message : 'Oshxona chekini chiqarib bo‘lmadi'),
    onSuccess: () => {
      setOrderSent(true);
      setCartOpen(false);
      if (!isTakeawayMode) {
        void navigate('/waiter/halls', { replace: true });
      }
    },
  });
  const printPrecheckMutation = usePrintWaiterPrecheckMutation({
    orderId: currentOrder?.id,
    orderNote: kitchenNote,
    onSuccess: () => toast.success(copy.receiptPrinted),
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
  const requestAddItem = (menuItem: WaiterMenuItem, sourceItem?: PosCartItem) => {
    if (menuItem.modifierGroups?.length) {
      setConfiguringItem({
        item: menuItem,
        initialNote: sourceItem?.note ?? '',
        initialSelections: sourceItem
          ? selectionsFromOrderModifiers(menuItem.modifierGroups, sourceItem.modifiers)
          : undefined,
      });
      return;
    }
    if (menuItem.itemType === 'service') {
      setPricingService({ item: menuItem, initialNote: sourceItem?.note ?? '', selections: [] });
      return;
    }
    if (menuItem.saleUnit === 'kg') {
      setWeighingItem({ item: menuItem, initialNote: sourceItem?.note ?? '', selections: [] });
      return;
    }
    addItem(menuItem, sourceItem?.note ?? '');
  };
  const requestAddItemWithNote = (menuItem: WaiterMenuItem) => {
    if (menuItem.modifierGroups?.length || menuItem.itemType === 'service' || menuItem.saleUnit === 'kg') {
      requestAddItem(menuItem);
      return;
    }
    setAddingItemWithNote(menuItem);
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
  const canTakePayment = canAccessCashierPayments(session?.user);
  const isSubmitDisabled = !currentOrder || submitOrderMutation.isPending || hasPendingOperations;
  const isPrecheckDisabled =
    !currentOrder || printPrecheckMutation.isPending || submitOrderMutation.isPending || hasPendingOperations;

  const handlePrintPrecheck = () => {
    if (isPrecheckDisabled) {
      return;
    }
    printPrecheckMutation.mutate(undefined, {
      onError: (error) => toast.error(error instanceof Error ? error.message : copy.receiptUnavailable),
    });
  };

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
        <PosBuilderHeader
          categoryId={selectedCategory?.id ?? ''}
          categoryTabs={categoryTabs}
          isMobile={isMobile}
          showMenuAction={!isTakeawayMode && Boolean(sessionId)}
          onCategoryChange={setSelectedCategoryId}
          onMenuOpen={() => navigate(`/menu/catalog?source=waiter&sessionId=${encodeURIComponent(sessionId ?? '')}`)}
          onLock={() => navigate('/lock-screen')}
          onRefresh={() => void refreshTransportAndReload()}
          onSettingsOpen={(event) => setSettingsAnchor(event.currentTarget)}
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
        <PosBuilderMenuPanel<WaiterMenuItem, WaiterMenuItemGroup>
          category={selectedCategory}
          itemCount={groupedOrderItems.reduce((sum, [, items]) => sum + items.length, 0)}
          isMobile={isMobile}
          locale={locale}
          menuLabel={copy.menu}
          itemCounts={menuItemMeta.countMap}
          latestItemIds={menuItemMeta.latestItemMap}
          total={currentOrder?.total}
          billsLabel={copy.bills}
          onAdd={requestAddItem}
          onAddWithNote={requestAddItemWithNote}
          onOpenGroup={setConfiguringGroup}
          onCartOpen={() => setCartOpen(true)}
          onRemove={removeItem}
        />

        <TableSessionDesktopCart
          avatarLabel={isTakeawayMode ? 'TG' : tableNumberLabel}
          canTakePayment={canTakePayment}
          copy={copy}
          groups={groupedOrderItems}
          isSubmitDisabled={isSubmitDisabled}
          isSubmitting={submitOrderMutation.isPending}
          isPrecheckDisabled={isPrecheckDisabled}
          isPrintingPrecheck={printPrecheckMutation.isPending}
          isTakeawayMode={isTakeawayMode}
          kitchenNote={kitchenNote}
          locale={locale}
          hallLabel={tableHallLabel}
          menuItems={menuItemById}
          operatorName={
            isTakeawayMode ? currentOperatorName : (sessionQuery.data?.assignedWaiterName ?? currentOperatorName)
          }
          orderModeMeta={orderModeMeta}
          orderSent={orderSent}
          selectedItemKey={selectedCartItemKey}
          serviceFee={currentOrder?.serviceFee}
          serviceFeeLabel={serviceFeeLabel}
          serviceFeeRows={serviceFeeRows}
          showServiceFee={shouldShowServiceFee}
          showVat={shouldShowVat}
          subtotal={currentOrder?.subtotal}
          total={currentOrder?.total}
          vatAmount={vatAmount}
          vatLabel={vatLabel}
          zoneLabel={tableZoneLabel}
          onAdd={requestAddItem}
          onEditItemNote={setEditingItemNote}
          onCheckout={() => void handleTakeawayCheckout()}
          onKitchenNoteChange={(value) => {
            setOrderSent(false);
            setKitchenNote(value);
          }}
          onPrintPrecheck={handlePrintPrecheck}
          onRemove={removeItem}
          onSelect={(key) => setSelectedCartItemKey((current) => (current === key ? null : key))}
          onSubmit={() => submitOrderMutation.mutate()}
        />
      </Box>

      <TableSessionMobileCart
        open={isMobile && cartOpen}
        avatarLabel=""
        canTakePayment={canTakePayment}
        copy={copy}
        groups={groupedOrderItems}
        isSubmitDisabled={isSubmitDisabled}
        isSubmitting={submitOrderMutation.isPending}
        isPrecheckDisabled={isPrecheckDisabled}
        isPrintingPrecheck={printPrecheckMutation.isPending}
        isTakeawayMode={isTakeawayMode}
        kitchenNote={kitchenNote}
        locale={locale}
        hallLabel={tableHallLabel}
        menuItems={menuItemById}
        operatorName=""
        orderModeMeta=""
        orderSent={orderSent}
        selectedItemKey={selectedCartItemKey}
        serviceFee={currentOrder?.serviceFee}
        serviceFeeLabel={serviceFeeLabel}
        serviceFeeRows={serviceFeeRows}
        showServiceFee={shouldShowServiceFee}
        showVat={shouldShowVat}
        subtotal={currentOrder?.subtotal}
        total={currentOrder?.total}
        vatAmount={vatAmount}
        vatLabel={vatLabel}
        zoneLabel={tableZoneLabel}
        onAdd={requestAddItem}
        onEditItemNote={setEditingItemNote}
        onCheckout={() => void handleTakeawayCheckout()}
        onClose={() => setCartOpen(false)}
        onKitchenNoteChange={(value) => {
          setOrderSent(false);
          setKitchenNote(value);
        }}
        onPrintPrecheck={handlePrintPrecheck}
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
      {configuringItem ? (
        <PosProductConfiguratorDialog
          item={configuringItem?.item ?? null}
          allowItemNote
          initialNote={configuringItem?.initialNote}
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
          onConfirm={(menuItem, selections, note) => {
            if (menuItem.itemType === 'service') {
              setPricingService({ item: menuItem, initialNote: note, selections });
            } else if (menuItem.saleUnit === 'kg') {
              setWeighingItem({ item: menuItem, initialNote: note, selections });
            } else {
              addItem(menuItem, note, selections);
            }
            setConfiguringItem(null);
          }}
        />
      ) : null}
      <PosItemGroupConfiguratorDialog
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
              note: line.note,
              selectedModifiers: line.selections,
            })),
          );
          setConfiguringGroup(null);
        }}
      />
      {pricingService ? (
        <PosServicePriceDialog
          item={pricingService.item}
          allowItemNote
          initialNote={pricingService.initialNote}
          locale={locale}
          onClose={() => setPricingService(null)}
          onConfirm={(manualPrice, note) => {
            addItem(pricingService.item, note, pricingService.selections, manualPrice);
            setPricingService(null);
          }}
        />
      ) : null}
      {weighingItem ? (
        <PosWeightedItemDialog
          item={weighingItem.item}
          allowItemNote
          initialNote={weighingItem.initialNote}
          selections={weighingItem.selections}
          locale={locale}
          onClose={() => setWeighingItem(null)}
          onConfirm={(quantity, note) => {
            addItems([
              {
                menuItem: weighingItem.item,
                quantity,
                note,
                selectedModifiers: weighingItem.selections,
              },
            ]);
            setWeighingItem(null);
          }}
        />
      ) : null}
      <PosItemNoteDialog
        itemLabel={addingItemWithNote?.name ?? ''}
        locale={locale}
        onClose={() => setAddingItemWithNote(null)}
        onSave={(note) => {
          if (!addingItemWithNote) return;
          addItem(addingItemWithNote, note);
          setAddingItemWithNote(null);
        }}
        open={Boolean(addingItemWithNote)}
      />
      <PosItemNoteDialog
        initialNote={editingItemNote?.note}
        itemLabel={editingItemNote?.catalogItemName ?? ''}
        locale={locale}
        onClose={() => setEditingItemNote(null)}
        onSave={(note) => editingItemNote && updateItemNoteMutation.mutate({ itemId: editingItemNote.id, note })}
        open={Boolean(editingItemNote)}
        saving={updateItemNoteMutation.isPending}
      />
      {inventoryCancellationDialog}
    </PosPageFrame>
  );
}
