import { Icon } from '@iconify/react';
import { Box, Button, Divider, Drawer, Stack, TextField, Typography, alpha, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
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
import { getDefaultWaiterMenuCategory, groupWaiterOrderItemsByStation } from 'modules/waiter/domain';
import { resolveApiBaseUrl } from 'shared/api/apiUrl';
import { refreshTransportAndReload } from 'shared/api/transportResolver';
import { PosPageFrame } from 'shared/layout/PosPageFrame';
import { formatPosCopy, getPosCopy } from 'shared/locale/copy';
import { useOptimisticBuilderOrder } from 'shared/pos/useOptimisticBuilderOrder';
import { formatCompactMoney, formatMoneyParts } from 'shared/pos/utils';
import {
  PosBuilderPageSkeleton,
  PosIconAction,
  PosOrderChannelSegment,
  PosSectionTabs,
  PosSettingsMenu,
} from 'shared/ui/pos-primitives';

type AggregatedWaiterCartItem = {
  key: string;
  id: string;
  catalogItem: string;
  catalogItemName: string;
  note?: string | null;
  quantity: number;
  lineTotal: number;
  status: string;
  itemIds: string[];
};

export type TableSessionPageContentProps = {
  sessionId: string | null;
  mode: 'hall' | 'takeaway';
  source?: string | null;
};

function formatOrderLabel(order: { orderNumber: number; displayName?: string | null } | null | undefined) {
  if (!order) {
    return 'ID 0';
  }
  const displayName = order.displayName?.trim();
  if (displayName) {
    return /^\d+$/.test(displayName) ? `#${displayName}` : displayName;
  }
  return `ID ${Number(order.orderNumber || 0)}`;
}

function formatPercent(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');
}

function resolveMenuItemImageUrl(imageUrl?: string | null) {
  if (!imageUrl) {
    return null;
  }

  try {
    return new URL(imageUrl, resolveApiBaseUrl()).toString();
  } catch {
    return imageUrl;
  }
}

export function TableSessionPageContent({ sessionId, mode, source = null }: TableSessionPageContentProps) {
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
  const submitOrderMutation = useSubmitWaiterOrderMutation({
    orderId: currentOrder?.id,
    sessionId,
    onPrintError: (error) => toast.error(error instanceof Error ? error.message : 'Oshxona chekini chiqarib bo‘lmadi'),
    onSuccess: () => {
      setOrderSent(true);
      setCartOpen(false);
    },
  });

  const categories = menuQuery.data ?? [];
  const defaultCategory = useMemo(() => getDefaultWaiterMenuCategory(categories), [categories]);
  const selectedCategory = categories.find((category) => category.id === selectedCategoryId) ?? defaultCategory;
  const groupedOrderItems = useMemo(() => {
    const stationGroups = groupWaiterOrderItemsByStation(currentOrder?.items, copy.menu);

    return stationGroups.map(([stationName, items]) => {
      const aggregatedMap = new Map<string, AggregatedWaiterCartItem>();

      for (const item of items) {
        const aggregationKey = [
          item.catalogItem,
          item.note ?? '',
          item.status,
          item.prepStationName ?? stationName,
        ].join('::');
        const existing = aggregatedMap.get(aggregationKey);

        if (existing) {
          existing.quantity += Number(item.quantity ?? 0);
          existing.lineTotal += Number(item.lineTotal ?? 0);
          existing.itemIds.push(item.id);
          existing.id = item.id;
          continue;
        }

        aggregatedMap.set(aggregationKey, {
          key: aggregationKey,
          id: item.id,
          catalogItem: item.catalogItem,
          catalogItemName: item.catalogItemName,
          note: item.note,
          quantity: Number(item.quantity ?? 0),
          lineTotal: Number(item.lineTotal ?? 0),
          status: item.status,
          itemIds: [item.id],
        });
      }

      return [stationName, Array.from(aggregatedMap.values())] as const;
    });
  }, [copy.menu, currentOrder?.items]);
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
      countMap.set(item.catalogItem, (countMap.get(item.catalogItem) ?? 0) + count);
      latestItemMap.set(item.catalogItem, item.id);
    }

    return { countMap, latestItemMap };
  }, [currentOrder?.items]);
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

  const createActionKeyHandler = (onActivate: () => void) => (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    onActivate();
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
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={{ xs: 1.1, md: 1.5 }}
          justifyContent="space-between"
          alignItems={{ xs: 'stretch', md: 'flex-start' }}>
          <Stack sx={{ flex: 1, minWidth: 0 }}>
            <PosSectionTabs
              value={selectedCategory?.id ?? ''}
              items={categoryTabs}
              onChange={setSelectedCategoryId}
              scrollable
            />
          </Stack>

          <Stack
            direction="row"
            spacing={{ xs: 1, md: 1.5 }}
            sx={{ justifyContent: { xs: 'flex-end', md: 'flex-start' } }}>
            {!isTakeawayMode && sessionId ? (
              <PosIconAction
                icon="solar:chef-hat-bold-duotone"
                onClick={() => navigate(`/menu/catalog?source=waiter&sessionId=${encodeURIComponent(sessionId)}`)}
              />
            ) : null}
            {!isMobile ? (
              <PosIconAction icon="solar:refresh-bold-duotone" onClick={() => void refreshTransportAndReload()} />
            ) : null}
            <PosIconAction
              icon="solar:settings-bold-duotone"
              onClick={(event) => setSettingsAnchor(event.currentTarget)}
            />
            {!isMobile ? (
              <PosIconAction icon="solar:lock-password-bold-duotone" onClick={() => navigate('/lock-screen')} />
            ) : null}
          </Stack>
        </Stack>
      }>
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 350px' },
          gap: { xs: 2, md: 2.5 },
        }}>
        <Stack
          spacing={2}
          sx={{
            minHeight: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
            px: 0.45,
            pt: 0.35,
            pb: 2,
            mx: -0.45,
          }}>
          <Typography variant="h4">{selectedCategory?.name ?? copy.menu}</Typography>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'repeat(2, minmax(0, 1fr))',
                md: 'repeat(2, minmax(0, 1fr))',
                lg: 'repeat(3, minmax(0, 1fr))',
                xl: 'repeat(4, minmax(0, 1fr))',
                '@media (min-width: 1800px)': {
                  gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
                },
              },
              gap: { xs: 1.1, md: 1.2, xl: 1.4 },
            }}>
            {(selectedCategory?.items ?? []).map((menuItem) => {
              const displayPrice = Number(menuItem.price ?? 0);
              const displayPriceParts = formatMoneyParts(displayPrice, locale);
              const menuItemImageUrl = resolveMenuItemImageUrl(menuItem.imageUrl);
              const selectedCountForMenuItem = menuItemMeta.countMap.get(menuItem.id) ?? 0;
              const hasSelectedCount = selectedCountForMenuItem > 0;

              return (
                <Box
                  key={menuItem.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => addItem(menuItem, kitchenNote)}
                  onKeyDown={createActionKeyHandler(() => addItem(menuItem, kitchenNote))}
                  sx={(theme) => ({
                    border: 0,
                    p: 0,
                    position: 'relative',
                    minHeight: { xs: 112, md: 118, xl: 126 },
                    overflow: 'hidden',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition:
                      'transform 0.16s ease, box-shadow 0.16s ease, background-color 0.16s ease, border-color 0.16s ease',
                    backgroundColor: 'var(--pos-menu-product-card-bg)',
                    backgroundImage: 'none',
                    boxShadow:
                      theme.palette.mode === 'dark'
                        ? 'inset 0 0 0 1px rgba(255,255,255,0.04)'
                        : 'inset 0 0 0 1px rgba(40,51,65,0.06)',
                    '&:hover': {
                      backgroundColor: 'var(--pos-menu-product-card-hover-bg)',
                      transform: 'translateY(-2px)',
                      boxShadow:
                        theme.palette.mode === 'dark'
                          ? '0 14px 26px rgba(0,0,0,0.26), inset 0 0 0 1px rgba(255,255,255,0.06)'
                          : '0 14px 28px rgba(40,51,65,0.12), inset 0 0 0 1px rgba(40,51,65,0.08)',
                    },
                    '&:active': {
                      transform: 'translateY(0) scale(0.985)',
                    },
                    '&:focus-visible': {
                      outline: `2px solid ${theme.palette.primary.main}`,
                      outlineOffset: 2,
                    },
                  })}>
                  {menuItemImageUrl ? (
                    <Box
                      component="img"
                      src={menuItemImageUrl}
                      alt={menuItem.name}
                      loading="lazy"
                      sx={{
                        position: 'absolute',
                        top: 10,
                        right: 10,
                        width: { xs: 48, md: 58 },
                        height: { xs: 48, md: 58 },
                        objectFit: 'cover',
                        borderRadius: '8px',
                        boxShadow: '0 8px 18px rgba(0,0,0,0.18)',
                        backgroundColor: alpha('#ffffff', 0.3),
                      }}
                    />
                  ) : null}
                  <Stack justifyContent="space-between" sx={{ height: '100%', minHeight: 0 }}>
                    <Stack
                      spacing={0.75}
                      sx={{
                        p: { xs: 1.25, md: 1.45, xl: 1.85 },
                        pr: menuItemImageUrl ? { xs: 7.25, md: 8.4, xl: 9.5 } : undefined,
                      }}>
                      <Typography variant="body2" color="text.secondary">
                        {menuItem.prepStationName ?? copy.menu}
                      </Typography>
                      <Typography variant="h6" sx={{ pr: 1 }}>
                        {menuItem.name}
                      </Typography>
                      {menuItem.description ? (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{
                            pr: 1,
                            overflow: 'hidden',
                            display: '-webkit-box',
                            WebkitBoxOrient: 'vertical',
                            WebkitLineClamp: 2,
                          }}>
                          {menuItem.description}
                        </Typography>
                      ) : null}
                    </Stack>
                    <Box
                      sx={(theme) => ({
                        minHeight: 40,
                        mt: 'auto',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        px: { xs: 1.2, md: 2 },
                        gap: 1.2,
                        fontSize: { xs: 14, md: 16 },
                        fontWeight: 700,
                        color: theme.palette.mode === 'dark' ? '#f0f2f5' : theme.palette.text.primary,
                        backgroundColor: 'var(--pos-menu-product-price-bg)',
                      })}>
                      {hasSelectedCount ? (
                        <Stack direction="row" spacing={0.8} alignItems="center">
                          <Box
                            sx={(theme) => ({
                              minWidth: 28,
                              height: 28,
                              px: 0.9,
                              borderRadius: '999px',
                              backgroundColor: theme.palette.mode === 'dark' ? '#141619' : '#252525',
                              color: '#ffffff',
                              display: 'grid',
                              placeItems: 'center',
                              fontSize: 14,
                              fontWeight: 700,
                              lineHeight: 1,
                            })}>
                            {selectedCountForMenuItem}
                          </Box>
                          <Box
                            component="button"
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              const latestItemId = menuItemMeta.latestItemMap.get(menuItem.id);
                              if (!latestItemId) {
                                return;
                              }
                              removeItem(latestItemId);
                            }}
                            sx={(theme) => ({
                              width: { xs: 28, md: 30 },
                              height: { xs: 28, md: 30 },
                              borderRadius: '50%',
                              border: 0,
                              display: 'grid',
                              placeItems: 'center',
                              backgroundColor: theme.palette.mode === 'dark' ? '#2a2d31' : alpha('#ffffff', 0.8),
                              color: theme.palette.mode === 'dark' ? '#ffffff' : '#23262b',
                              cursor: 'pointer',
                              transition: 'transform 0.14s ease, background-color 0.14s ease, box-shadow 0.14s ease',
                              boxShadow:
                                theme.palette.mode === 'dark'
                                  ? 'inset 0 0 0 1px rgba(255,255,255,0.08)'
                                  : 'inset 0 0 0 1px rgba(35,38,43,0.12)',
                              '&:hover': {
                                backgroundColor: theme.palette.mode === 'dark' ? '#363a40' : '#ffffff',
                              },
                              '&:active': {
                                transform: 'scale(0.92)',
                              },
                              '&:focus-visible': {
                                outline: `2px solid ${theme.palette.primary.main}`,
                                outlineOffset: 1,
                              },
                            })}>
                            <Icon icon="solar:minus-circle-bold" width={18} />
                          </Box>
                          <Box
                            component="button"
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              addItem(menuItem, kitchenNote);
                            }}
                            sx={(theme) => ({
                              width: { xs: 28, md: 30 },
                              height: { xs: 28, md: 30 },
                              borderRadius: '50%',
                              border: 0,
                              display: 'grid',
                              placeItems: 'center',
                              backgroundColor: theme.palette.mode === 'dark' ? '#2a2d31' : alpha('#ffffff', 0.8),
                              color: theme.palette.mode === 'dark' ? '#ffffff' : '#23262b',
                              cursor: 'pointer',
                              transition: 'transform 0.14s ease, background-color 0.14s ease, box-shadow 0.14s ease',
                              boxShadow:
                                theme.palette.mode === 'dark'
                                  ? 'inset 0 0 0 1px rgba(255,255,255,0.08)'
                                  : 'inset 0 0 0 1px rgba(35,38,43,0.12)',
                              '&:hover': {
                                backgroundColor: theme.palette.mode === 'dark' ? '#363a40' : '#ffffff',
                              },
                              '&:active': {
                                transform: 'scale(0.92)',
                              },
                              '&:focus-visible': {
                                outline: `2px solid ${theme.palette.primary.main}`,
                                outlineOffset: 1,
                              },
                            })}>
                            <Icon icon="solar:add-circle-bold" width={18} />
                          </Box>
                        </Stack>
                      ) : null}
                      <Typography
                        component="span"
                        sx={{
                          ml: 'auto',
                          display: 'inline-flex',
                          alignItems: 'baseline',
                          gap: 0.45,
                          textAlign: 'right',
                          fontWeight: 800,
                          whiteSpace: 'nowrap',
                        }}>
                        <Box component="span" sx={{ fontSize: { xs: 20, md: 24 }, lineHeight: 1, fontWeight: 900 }}>
                          {displayPriceParts.amount}
                        </Box>
                        <Box component="span" sx={{ fontSize: { xs: 13.5, md: 16 }, lineHeight: 1, fontWeight: 700 }}>
                          {displayPriceParts.currency}
                        </Box>
                      </Typography>
                    </Box>
                  </Stack>
                </Box>
              );
            })}
          </Box>

          {isMobile ? (
            <Box
              sx={(theme) => ({
                position: 'sticky',
                bottom: 0,
                zIndex: 6,
                borderRadius: '18px',
                backgroundColor: 'var(--pos-mobile-summary-bg)',
                backdropFilter: 'blur(18px)',
                border: `1px solid ${alpha('#ffffff', theme.palette.mode === 'dark' ? 0.08 : 0.34)}`,
                boxShadow: 'var(--pos-mobile-summary-shadow)',
                px: 1.4,
                py: 1.2,
              })}>
              <Stack direction="row" spacing={1.1} alignItems="center">
                <Stack sx={{ flex: 1, minWidth: 0 }} spacing={0.15}>
                  <Typography variant="body2" color="text.secondary">
                    {groupedOrderItems.reduce((sum, [, items]) => sum + items.length, 0)} {copy.menu}
                  </Typography>
                  <Typography variant="h6" noWrap>
                    {formatCompactMoney(currentOrder?.total, locale)}
                  </Typography>
                </Stack>
                <Button variant="contained" sx={{ minWidth: 132 }} onClick={() => setCartOpen(true)}>
                  {copy.bills}
                </Button>
              </Stack>
            </Box>
          ) : null}
        </Stack>

        <Box
          sx={(theme) => ({
            display: { xs: 'none', md: 'flex' },
            borderRadius: '14px',
            overflow: 'hidden',
            height: '100%',
            minHeight: 0,
            backgroundColor: 'var(--pos-order-panel-bg)',
            flexDirection: 'column',
            border: `1px solid ${alpha('#ffffff', theme.palette.mode === 'dark' ? 0.04 : 0.3)}`,
          })}>
          <Box sx={{ p: 2.5 }}>
            <Stack spacing={1.7}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Box
                  sx={(theme) => ({
                    minWidth: 66,
                    height: 66,
                    borderRadius: '10px',
                    backgroundColor: 'var(--pos-order-avatar-bg)',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 30,
                    fontWeight: 700,
                    lineHeight: 1,
                  })}>
                  {isTakeawayMode ? 'TG' : (sessionQuery.data?.tableName?.match(/\d+/)?.[0] ?? '0')}
                </Box>

                <Stack spacing={0.45} sx={{ minWidth: 0 }}>
                  <Typography variant="body1" color="text.secondary">
                    {copy.orders}: {formatOrderLabel(currentOrder)}
                  </Typography>
                  <Stack direction="row" spacing={1.4} alignItems="center" useFlexGap flexWrap="wrap">
                    <Stack direction="row" spacing={0.7} alignItems="center" minWidth={0}>
                      <Icon icon="solar:user-rounded-bold-duotone" width={18} />
                      <Typography variant="body2" color="text.secondary" noWrap>
                        {orderModeMeta}
                      </Typography>
                    </Stack>
                    <Stack direction="row" spacing={0.7} alignItems="center" minWidth={0}>
                      <Icon icon="solar:plate-bold-duotone" width={18} />
                      <Typography variant="body2" color="text.secondary" noWrap>
                        {isTakeawayMode
                          ? currentOperatorName
                          : (sessionQuery.data?.assignedWaiterName ?? currentOperatorName)}
                      </Typography>
                    </Stack>
                  </Stack>
                </Stack>
              </Stack>

              <PosOrderChannelSegment
                hallLabel={copy.hall}
                takeawayLabel={copy.takeaway}
                channel={currentOrder?.channel ?? mode}
              />
            </Stack>
          </Box>

          <Box sx={{ px: 2.5, pb: 2, flex: 1, overflowY: 'auto' }}>
            <Stack spacing={1.6}>
              {groupedOrderItems.length > 0 ? (
                groupedOrderItems.map(([stationName, items]) => (
                  <Stack key={stationName} spacing={0.9}>
                    <Typography variant="body2" color="text.secondary">
                      {stationName}
                    </Typography>
                    {items.map((item) => (
                      <Box
                        key={item.key}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedCartItemKey((current) => (current === item.key ? null : item.key))}
                        onKeyDown={createActionKeyHandler(() =>
                          setSelectedCartItemKey((current) => (current === item.key ? null : item.key)),
                        )}
                        sx={(theme) => ({
                          width: '100%',
                          border: 0,
                          p: 0,
                          textAlign: 'left',
                          borderRadius: '10px',
                          overflow: 'hidden',
                          backgroundColor: 'var(--pos-cart-item-bg)',
                          transition:
                            'background-color 0.16s ease, box-shadow 0.16s ease, transform 0.16s ease, border-color 0.16s ease',
                          boxShadow:
                            selectedCartItemKey === item.key
                              ? `inset 0 0 0 1px ${alpha(theme.palette.primary.main, 0.44)}`
                              : 'none',
                          '&:hover': {
                            backgroundColor: 'var(--pos-cart-item-hover-bg)',
                            transform: 'translateY(-1px)',
                          },
                          '&:active': {
                            transform: 'translateY(0) scale(0.992)',
                          },
                        })}>
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ p: 1.65 }}>
                          <Stack spacing={0.35} sx={{ pr: 1 }}>
                            <Typography
                              variant="subtitle1"
                              sx={
                                item.status === 'cancelled'
                                  ? { textDecoration: 'line-through', opacity: 0.68 }
                                  : undefined
                              }>
                              {formatPosCopy(copy.itemQuantityLabel, {
                                name: item.catalogItemName,
                                quantity: item.quantity,
                              })}
                            </Typography>
                            {item.note ? (
                              <Typography variant="body2" color="text.secondary">
                                {item.note}
                              </Typography>
                            ) : null}
                          </Stack>
                          <Typography variant="subtitle1" sx={{ whiteSpace: 'nowrap' }}>
                            {formatCompactMoney(item.lineTotal, locale)}
                          </Typography>
                        </Stack>
                        {selectedCartItemKey === item.key &&
                        item.status !== 'cancelled' &&
                        menuItemById.has(item.catalogItem) ? (
                          <Stack
                            direction="row"
                            alignItems="center"
                            justifyContent="space-between"
                            spacing={1.2}
                            sx={(theme) => ({
                              borderTop: `1px solid ${alpha('#ffffff', theme.palette.mode === 'dark' ? 0.06 : 0.45)}`,
                              backgroundColor: 'var(--pos-menu-item-price-bg)',
                              px: 1.35,
                              py: 1.1,
                            })}>
                            <Box
                              component="button"
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                const latestItemId = item.itemIds[item.itemIds.length - 1];
                                removeItem(latestItemId);
                              }}
                              sx={(theme) => ({
                                width: 42,
                                height: 42,
                                border: 0,
                                display: 'grid',
                                placeItems: 'center',
                                cursor: 'pointer',
                                borderRadius: '14px',
                                color: theme.palette.mode === 'dark' ? '#f6f7f9' : '#262a30',
                                backgroundColor: 'var(--pos-cart-action-bg)',
                                transition: 'background-color 0.14s ease, transform 0.14s ease, box-shadow 0.14s ease',
                                boxShadow:
                                  theme.palette.mode === 'dark'
                                    ? 'inset 0 0 0 1px rgba(255,255,255,0.08)'
                                    : 'inset 0 0 0 1px rgba(38,42,48,0.08)',
                                '&:hover': {
                                  backgroundColor: 'var(--pos-cart-action-hover-bg)',
                                },
                                '&:active': {
                                  transform: 'scale(0.94)',
                                },
                              })}>
                              <Icon icon="solar:minus-circle-bold" width={22} />
                            </Box>
                            <Box
                              component="button"
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                const menuItem = menuItemById.get(item.catalogItem);
                                if (!menuItem) {
                                  return;
                                }
                                addItem(menuItem, kitchenNote);
                              }}
                              sx={(theme) => ({
                                width: 42,
                                height: 42,
                                border: 0,
                                display: 'grid',
                                placeItems: 'center',
                                cursor: 'pointer',
                                borderRadius: '14px',
                                color: theme.palette.mode === 'dark' ? '#f6f7f9' : '#262a30',
                                backgroundColor: 'var(--pos-cart-action-bg)',
                                transition: 'background-color 0.14s ease, transform 0.14s ease, box-shadow 0.14s ease',
                                boxShadow:
                                  theme.palette.mode === 'dark'
                                    ? 'inset 0 0 0 1px rgba(255,255,255,0.08)'
                                    : 'inset 0 0 0 1px rgba(38,42,48,0.08)',
                                '&:hover': {
                                  backgroundColor: 'var(--pos-cart-action-hover-bg)',
                                },
                                '&:active': {
                                  transform: 'scale(0.94)',
                                },
                              })}>
                              <Icon icon="solar:add-circle-bold" width={22} />
                            </Box>
                          </Stack>
                        ) : null}
                      </Box>
                    ))}
                  </Stack>
                ))
              ) : (
                <Stack sx={{ py: 14, textAlign: 'center' }} spacing={1}>
                  <Typography variant="h6">{copy.emptyOrder}</Typography>
                  <Typography variant="body1" color="text.secondary">
                    {copy.chooseFromMenu}
                  </Typography>
                </Stack>
              )}
            </Stack>
          </Box>

          <Divider />

          <Stack spacing={1.5} sx={{ p: 2.5 }}>
            {orderSent ? (
              <Box
                sx={(theme) => ({
                  borderRadius: '10px',
                  px: 1.4,
                  py: 1.1,
                  backgroundColor: theme.palette.mode === 'dark' ? alpha('#24c5bf', 0.12) : alpha('#1384ef', 0.08),
                  border: `1px solid ${alpha(theme.palette.primary.main, 0.24)}`,
                })}>
                <Typography variant="body2">{copy.orderSent}</Typography>
              </Box>
            ) : null}

            <TextField
              label={copy.kitchenNote}
              value={kitchenNote}
              onChange={(event) => {
                setOrderSent(false);
                setKitchenNote(event.target.value);
              }}
              multiline
              minRows={1}
            />

            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body1" color="text.secondary">
                {copy.subtotal}:
              </Typography>
              <Typography variant="body1" color="text.secondary">
                {formatCompactMoney(currentOrder?.subtotal, locale)}
              </Typography>
            </Stack>
            {shouldShowServiceFee ? (
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body1" color="text.secondary">
                  {serviceFeeLabel}:
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  {formatCompactMoney(currentOrder?.serviceFee, locale)}
                </Typography>
              </Stack>
            ) : null}
            {shouldShowVat ? (
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body1" color="text.secondary">
                  {vatLabel}:
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  {formatCompactMoney(vatAmount, locale)}
                </Typography>
              </Stack>
            ) : null}
            <Stack direction="row" justifyContent="space-between" alignItems="flex-end">
              <Typography variant="h5">{copy.grandTotal}:</Typography>
              <Typography variant="h4" sx={{ lineHeight: 1.05, textAlign: 'right' }}>
                {formatCompactMoney(currentOrder?.total, locale)}
              </Typography>
            </Stack>

            <Stack direction="row" spacing={1.2}>
              {isTakeawayMode ? (
                <>
                  <Button
                    variant="contained"
                    sx={(theme) => ({
                      flex: 1,
                      backgroundImage: 'none',
                      backgroundColor: theme.palette.mode === 'dark' ? '#464646' : '#d7cebf',
                      color: theme.palette.mode === 'dark' ? '#f5f5f5' : theme.palette.text.primary,
                    })}
                    disabled={isSubmitDisabled}
                    onClick={() => submitOrderMutation.mutate()}>
                    {submitOrderMutation.isPending ? copy.processing : copy.sendOrder}
                  </Button>
                  <Button
                    variant="contained"
                    sx={{ flex: 1.15 }}
                    disabled={isSubmitDisabled}
                    onClick={() => void handleTakeawayCheckout()}>
                    {canTakePayment ? copy.goToPayment : copy.sendToCashier}
                  </Button>
                </>
              ) : (
                <Button
                  variant="contained"
                  sx={{ flex: 1 }}
                  disabled={isSubmitDisabled}
                  onClick={() => submitOrderMutation.mutate()}>
                  {submitOrderMutation.isPending ? copy.processing : copy.sendOrder}
                </Button>
              )}
            </Stack>
          </Stack>
        </Box>
      </Box>

      <Drawer
        anchor="bottom"
        open={isMobile && cartOpen}
        onClose={() => setCartOpen(false)}
        PaperProps={{
          sx: {
            height: 'min(82dvh, 860px)',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            backgroundImage: 'none',
            overflow: 'hidden',
          },
        }}>
        <Stack sx={{ height: '100%' }}>
          <Stack
            direction="row"
            spacing={1.2}
            alignItems="center"
            justifyContent="space-between"
            sx={{ px: 2, py: 1.5 }}>
            <Stack spacing={0.25}>
              <Typography variant="h6">{copy.bills}</Typography>
              <Typography variant="body2" color="text.secondary">
                {copy.orders}: {formatOrderLabel(currentOrder)}
              </Typography>
            </Stack>
            <PosIconAction icon="solar:close-circle-bold-duotone" onClick={() => setCartOpen(false)} />
          </Stack>
          <Box sx={{ px: 2, pb: 1.35 }}>
            <PosOrderChannelSegment
              hallLabel={copy.hall}
              takeawayLabel={copy.takeaway}
              channel={currentOrder?.channel ?? mode}
              compact
            />
          </Box>
          <Divider />
          <Box sx={{ px: 2, py: 1.5, flex: 1, overflowY: 'auto' }}>
            <Stack spacing={1.25}>
              {groupedOrderItems.map(([stationName, items]) => (
                <Stack key={stationName} spacing={0.85}>
                  <Typography variant="body2" color="text.secondary">
                    {stationName}
                  </Typography>
                  {items.map((item) => (
                    <Box
                      key={item.key}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedCartItemKey((current) => (current === item.key ? null : item.key))}
                      onKeyDown={createActionKeyHandler(() =>
                        setSelectedCartItemKey((current) => (current === item.key ? null : item.key)),
                      )}
                      sx={(theme) => ({
                        width: '100%',
                        border: 0,
                        p: 0,
                        textAlign: 'left',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        backgroundColor: 'var(--pos-cart-item-bg)',
                        boxShadow:
                          selectedCartItemKey === item.key
                            ? `inset 0 0 0 1px ${alpha(theme.palette.primary.main, 0.44)}`
                            : 'none',
                      })}>
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ p: 1.5 }}>
                        <Stack spacing={0.25} sx={{ pr: 1, minWidth: 0 }}>
                          <Typography
                            variant="subtitle2"
                            sx={
                              item.status === 'cancelled'
                                ? { textDecoration: 'line-through', opacity: 0.68 }
                                : undefined
                            }>
                            {formatPosCopy(copy.itemQuantityLabel, {
                              name: item.catalogItemName,
                              quantity: item.quantity,
                            })}
                          </Typography>
                          {item.note ? (
                            <Typography variant="caption" color="text.secondary">
                              {item.note}
                            </Typography>
                          ) : null}
                        </Stack>
                        <Typography variant="subtitle2">{formatCompactMoney(item.lineTotal, locale)}</Typography>
                      </Stack>
                      {selectedCartItemKey === item.key &&
                      item.status !== 'cancelled' &&
                      menuItemById.has(item.catalogItem) ? (
                        <Stack
                          direction="row"
                          spacing={1}
                          alignItems="center"
                          justifyContent="space-between"
                          sx={(theme) => ({
                            px: 1.1,
                            py: 1,
                            borderTop: `1px solid ${alpha('#ffffff', theme.palette.mode === 'dark' ? 0.06 : 0.45)}`,
                            backgroundColor: 'var(--pos-menu-item-price-bg)',
                          })}>
                          <Button
                            variant="contained"
                            onClick={(event) => {
                              event.stopPropagation();
                              const latestItemId = item.itemIds[item.itemIds.length - 1];
                              removeItem(latestItemId);
                            }}
                            sx={{ minWidth: 54, px: 0 }}>
                            <Icon icon="solar:minus-circle-bold" width={18} />
                          </Button>
                          <Button
                            variant="contained"
                            onClick={(event) => {
                              event.stopPropagation();
                              const menuItem = menuItemById.get(item.catalogItem);
                              if (menuItem) {
                                addItem(menuItem, kitchenNote);
                              }
                            }}
                            sx={{ minWidth: 54, px: 0 }}>
                            <Icon icon="solar:add-circle-bold" width={18} />
                          </Button>
                        </Stack>
                      ) : null}
                    </Box>
                  ))}
                </Stack>
              ))}
            </Stack>
          </Box>
          <Divider />
          <Stack spacing={1.25} sx={{ px: 2, py: 1.6 }}>
            <TextField
              label={copy.kitchenNote}
              value={kitchenNote}
              onChange={(event) => {
                setOrderSent(false);
                setKitchenNote(event.target.value);
              }}
              multiline
              minRows={2}
            />
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">
                {copy.subtotal}
              </Typography>
              <Typography variant="body2">{formatCompactMoney(currentOrder?.subtotal, locale)}</Typography>
            </Stack>
            {shouldShowServiceFee ? (
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">
                  {serviceFeeLabel}
                </Typography>
                <Typography variant="body2">{formatCompactMoney(currentOrder?.serviceFee, locale)}</Typography>
              </Stack>
            ) : null}
            {shouldShowVat ? (
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">
                  {vatLabel}
                </Typography>
                <Typography variant="body2">{formatCompactMoney(vatAmount, locale)}</Typography>
              </Stack>
            ) : null}
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">
                {copy.grandTotal}
              </Typography>
              <Typography variant="h6">{formatCompactMoney(currentOrder?.total, locale)}</Typography>
            </Stack>
            <Stack direction="row" spacing={1}>
              {isTakeawayMode ? (
                <>
                  <Button
                    variant="contained"
                    sx={(theme) => ({
                      flex: 1,
                      backgroundImage: 'none',
                      backgroundColor: theme.palette.mode === 'dark' ? '#464646' : '#d7cebf',
                      color: theme.palette.mode === 'dark' ? '#f5f5f5' : theme.palette.text.primary,
                    })}
                    disabled={isSubmitDisabled}
                    onClick={() => submitOrderMutation.mutate()}>
                    {submitOrderMutation.isPending ? copy.processing : copy.sendOrder}
                  </Button>
                  <Button
                    variant="contained"
                    sx={{ flex: 1.15 }}
                    disabled={isSubmitDisabled}
                    onClick={() => void handleTakeawayCheckout()}>
                    {canTakePayment ? copy.goToPayment : copy.sendToCashier}
                  </Button>
                </>
              ) : (
                <Button
                  variant="contained"
                  sx={{ flex: 1 }}
                  disabled={isSubmitDisabled}
                  onClick={() => submitOrderMutation.mutate()}>
                  {submitOrderMutation.isPending ? copy.processing : copy.sendOrder}
                </Button>
              )}
            </Stack>
          </Stack>
        </Stack>
      </Drawer>

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
