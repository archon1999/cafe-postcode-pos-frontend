import { Icon } from '@iconify/react';
import { Box, Button, Divider, Drawer, Stack, TextField, Typography, alpha, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router';

import { usePosSession } from 'modules/auth';
import {
  useCashierBuilderOrdersQuery,
  useCashierMenuQuery,
  useSubmitCashierOrderMutation,
  cashierKeys,
} from 'modules/cashier/application';
import { cashierRepository } from 'modules/cashier/data-access';
import {
  getCurrentCashierBuilderOrder,
  getDefaultCashierMenuCategory,
  groupCashierOrderItemsByStation,
} from 'modules/cashier/domain';
import { PosPageFrame } from 'shared/layout/PosPageFrame';
import { getPosCopy } from 'shared/locale/copy';
import { useOptimisticBuilderOrder } from 'shared/pos/useOptimisticBuilderOrder';
import { formatCompactMoney } from 'shared/pos/utils';
import { resolveApiBaseUrl } from 'shared/api/apiUrl';
import {
  PosBuilderPageSkeleton,
  PosIconAction,
  PosOrderChannelSegment,
  PosSectionTabs,
  PosSettingsMenu,
} from 'shared/ui/pos-primitives';

type AggregatedCashierCartItem = {
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

export function CashierBuilderPageContent() {
  const navigate = useNavigate();
  const { session, locale, setLocale, setSession, themeMode, setThemeMode } = usePosSession();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const copy = getPosCopy(locale);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [kitchenNote, setKitchenNote] = useState('');
  const [settingsAnchor, setSettingsAnchor] = useState<HTMLElement | null>(null);
  const [selectedCartItemKey, setSelectedCartItemKey] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);

  const menuQuery = useCashierMenuQuery();
  const ordersQuery = useCashierBuilderOrdersQuery();
  const serverOrder = useMemo(
    () => getCurrentCashierBuilderOrder(ordersQuery.data, session?.user.id),
    [ordersQuery.data, session?.user.id],
  );
  const { currentOrder, addItem, removeItem, hasPendingOperations } = useOptimisticBuilderOrder({
    baseOrder: serverOrder,
    canonicalQueryKey: cashierKeys.builderOrders,
    canonicalQueryFn: () => cashierRepository.getOpenOrders(),
    channel: 'takeaway',
    createOrder: async (note) => {
      const response = await cashierRepository.createTakeawayOrder(note);
      return response.id;
    },
    defaultServiceFeePercent: 0,
    removeOrderItem: (itemId) => cashierRepository.removeOrderItem(itemId),
    selectCurrentOrder: (orders) => getCurrentCashierBuilderOrder(orders, session?.user.id),
    addOrderItem: (orderId, menuItem, note) => cashierRepository.addOrderItem(orderId, menuItem.id, note),
    syncErrorMessage: copy.itemSyncFailed,
  });
  const submitOrderMutation = useSubmitCashierOrderMutation({
    orderId: currentOrder?.id,
    onSuccess: () => {
      setKitchenNote('');
      setCartOpen(false);
    },
  });

  const categories = menuQuery.data ?? [];
  const defaultCategory = useMemo(() => getDefaultCashierMenuCategory(categories), [categories]);
  const selectedCategory = categories.find((category) => category.id === selectedCategoryId) ?? defaultCategory;
  const groupedOrderItems = useMemo(() => {
    const stationGroups = groupCashierOrderItemsByStation(currentOrder?.items, copy.menu);

    return stationGroups.map(([stationName, items]) => {
      const aggregatedMap = new Map<string, AggregatedCashierCartItem>();

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
  const serviceFeePercent = Number(currentOrder?.serviceFeePercent ?? 0);
  const serviceFeeLabel = `${copy.serviceFee} (${serviceFeePercent}%)`;
  const isSubmitDisabled = !currentOrder || submitOrderMutation.isPending || hasPendingOperations;

  const createActionKeyHandler = (onActivate: () => void) => (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    onActivate();
  };

  const handleCheckout = async () => {
    if (!currentOrder || submitOrderMutation.isPending || hasPendingOperations) {
      return;
    }

    await submitOrderMutation.mutateAsync();
    setCartOpen(false);
    navigate(`/cashier/payment?orderId=${currentOrder.id}`);
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
            <PosIconAction icon="solar:bill-list-bold-duotone" onClick={() => navigate('/cashier/open-checks')} />
            {!isMobile ? (
              <PosIconAction icon="solar:refresh-bold-duotone" onClick={() => window.location.reload()} />
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
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 360px' },
          gap: { xs: 2, md: 2.5 },
        }}>
        <Stack spacing={2} sx={{ minHeight: 0, overflowY: 'auto', overflowX: 'hidden', pb: 0.4 }}>
          <Typography variant="h4">{selectedCategory?.name ?? copy.menu}</Typography>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'repeat(2, minmax(0, 1fr))',
                md: 'repeat(2, minmax(0, 1fr))',
                lg: 'repeat(4, minmax(0, 1fr))',
              },
              gap: 1.4,
            }}>
            {(selectedCategory?.items ?? []).map((menuItem) => {
              const displayPrice = Number(menuItem.price ?? 0);
              const menuItemImageUrl = resolveMenuItemImageUrl(menuItem.imageUrl);
              const hasSelectedCount = (menuItemMeta.countMap.get(menuItem.id) ?? 0) > 0;

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
                    minHeight: { xs: 114, md: 126 },
                    overflow: 'hidden',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition:
                      'transform 0.16s ease, box-shadow 0.16s ease, background-color 0.16s ease, border-color 0.16s ease',
                    backgroundColor: theme.palette.mode === 'dark' ? '#26282c' : '#f1e7da',
                    backgroundImage: 'none',
                    boxShadow:
                      theme.palette.mode === 'dark'
                        ? 'inset 0 0 0 1px rgba(255,255,255,0.04)'
                        : 'inset 0 0 0 1px rgba(40,51,65,0.06)',
                    '&:hover': {
                      backgroundColor: theme.palette.mode === 'dark' ? '#2d3035' : '#ebe1d3',
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
                  {(menuItemMeta.countMap.get(menuItem.id) ?? 0) > 0 ? (
                    <Box
                      sx={(theme) => ({
                        position: 'absolute',
                        top: 10,
                        left: 10,
                        minWidth: 32,
                        height: 32,
                        px: 1,
                        borderRadius: '50%',
                        backgroundColor: theme.palette.mode === 'dark' ? '#141619' : '#252525',
                        color: '#ffffff',
                        display: 'grid',
                        placeItems: 'center',
                        fontSize: 15,
                        fontWeight: 700,
                        boxShadow: '0 8px 18px rgba(0,0,0,0.2)',
                      })}>
                      {menuItemMeta.countMap.get(menuItem.id)}
                    </Box>
                  ) : null}
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
                  <Stack justifyContent="space-between" sx={{ minHeight: { xs: 114, md: 126 } }}>
                    <Stack
                      spacing={0.75}
                      sx={{
                        p: { xs: 1.35, md: 1.85 },
                        pr: menuItemImageUrl ? { xs: 7.25, md: 9.5 } : undefined,
                        pl: hasSelectedCount ? { xs: 5.25, md: 5.75 } : undefined,
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
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        px: { xs: 1.2, md: 2 },
                        gap: 1.2,
                        fontSize: { xs: 14, md: 16 },
                        fontWeight: 700,
                        color: theme.palette.mode === 'dark' ? '#f0f2f5' : theme.palette.text.primary,
                        backgroundColor: theme.palette.mode === 'dark' ? '#4f555d' : '#d9d0c2',
                      })}>
                      <Typography component="span" sx={{ fontWeight: 700, fontSize: { xs: 13.5, md: 16 } }}>
                        {formatCompactMoney(displayPrice, locale)}
                      </Typography>
                      {(menuItemMeta.countMap.get(menuItem.id) ?? 0) > 0 ? (
                        <Stack direction="row" spacing={0.8}>
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
                backgroundColor: theme.palette.mode === 'dark' ? alpha('#23262b', 0.94) : alpha('#faf4ea', 0.96),
                backdropFilter: 'blur(18px)',
                border: `1px solid ${alpha('#ffffff', theme.palette.mode === 'dark' ? 0.08 : 0.34)}`,
                boxShadow:
                  theme.palette.mode === 'dark' ? '0 18px 32px rgba(0,0,0,0.3)' : '0 16px 30px rgba(98,70,38,0.14)',
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
            backgroundColor: theme.palette.mode === 'dark' ? '#1f2125' : '#f8f1e8',
            flexDirection: 'column',
            border: `1px solid ${alpha('#ffffff', theme.palette.mode === 'dark' ? 0.04 : 0.3)}`,
          })}>
          <Box sx={{ p: 2.25 }}>
            <Stack spacing={1.7}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Box
                  sx={(theme) => ({
                    minWidth: 64,
                    height: 64,
                    borderRadius: '10px',
                    backgroundColor: theme.palette.mode === 'dark' ? '#464b53' : '#dad2c4',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 28,
                    fontWeight: 700,
                  })}>
                  TG
                </Box>

                <Stack spacing={0.45}>
                  <Typography variant="body1" color="text.secondary">
                    {copy.orders}: {currentOrder ? `A${String(currentOrder.orderNumber).padStart(5, '0')}` : 'A00000'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {session?.user.fullName}
                  </Typography>
                </Stack>
              </Stack>

              <PosOrderChannelSegment hallLabel={copy.hall} takeawayLabel={copy.takeaway} channel="takeaway" />
            </Stack>
          </Box>

          <Box sx={{ px: 2.25, pb: 2, flex: 1, overflowY: 'auto' }}>
            <Stack spacing={1.45}>
              {groupedOrderItems.length > 0 ? (
                groupedOrderItems.map(([stationName, items]) => (
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
                          borderRadius: '10px',
                          overflow: 'hidden',
                          backgroundColor: theme.palette.mode === 'dark' ? '#2c2f34' : '#ede4d7',
                          transition:
                            'background-color 0.16s ease, box-shadow 0.16s ease, transform 0.16s ease, border-color 0.16s ease',
                          boxShadow:
                            selectedCartItemKey === item.key
                              ? `inset 0 0 0 1px ${alpha(theme.palette.primary.main, 0.44)}`
                              : 'none',
                          '&:hover': {
                            backgroundColor: theme.palette.mode === 'dark' ? '#33363c' : '#e7ded1',
                            transform: 'translateY(-1px)',
                          },
                          '&:active': {
                            transform: 'translateY(0) scale(0.992)',
                          },
                        })}>
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ p: 1.55 }}>
                          <Stack spacing={0.35} sx={{ pr: 1 }}>
                            <Typography
                              variant="subtitle1"
                              sx={
                                item.status === 'cancelled'
                                  ? { textDecoration: 'line-through', opacity: 0.68 }
                                  : undefined
                              }>
                              {item.catalogItemName} (x{item.quantity})
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
                              backgroundColor: theme.palette.mode === 'dark' ? '#383c42' : '#ddd4c7',
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
                                backgroundColor: theme.palette.mode === 'dark' ? '#272a2f' : '#f5efe5',
                                transition: 'background-color 0.14s ease, transform 0.14s ease, box-shadow 0.14s ease',
                                boxShadow:
                                  theme.palette.mode === 'dark'
                                    ? 'inset 0 0 0 1px rgba(255,255,255,0.08)'
                                    : 'inset 0 0 0 1px rgba(38,42,48,0.08)',
                                '&:hover': {
                                  backgroundColor: theme.palette.mode === 'dark' ? '#2f343a' : '#ffffff',
                                },
                                '&:active': {
                                  transform: 'scale(0.94)',
                                },
                              })}>
                              <Icon icon="solar:minus-circle-bold" width={22} />
                            </Box>
                            <Stack spacing={0.1} alignItems="center" sx={{ flex: 1 }}>
                              <Typography variant="body2" color="text.secondary">
                                {item.catalogItemName}
                              </Typography>
                              <Typography variant="h6" sx={{ lineHeight: 1 }}>
                                x{item.quantity}
                              </Typography>
                            </Stack>
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
                                backgroundColor: theme.palette.mode === 'dark' ? '#272a2f' : '#f5efe5',
                                transition: 'background-color 0.14s ease, transform 0.14s ease, box-shadow 0.14s ease',
                                boxShadow:
                                  theme.palette.mode === 'dark'
                                    ? 'inset 0 0 0 1px rgba(255,255,255,0.08)'
                                    : 'inset 0 0 0 1px rgba(38,42,48,0.08)',
                                '&:hover': {
                                  backgroundColor: theme.palette.mode === 'dark' ? '#2f343a' : '#ffffff',
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
                    {copy.builderEmpty}
                  </Typography>
                </Stack>
              )}
            </Stack>
          </Box>

          <Divider />

          <Stack spacing={1.4} sx={{ p: 2.25 }}>
            <TextField
              label={copy.kitchenNote}
              value={kitchenNote}
              onChange={(event) => setKitchenNote(event.target.value)}
              multiline
              minRows={2}
            />

            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body1" color="text.secondary">
                {copy.subtotal}:
              </Typography>
              <Typography variant="body1" color="text.secondary">
                {formatCompactMoney(currentOrder?.subtotal, locale)}
              </Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body1" color="text.secondary">
                {serviceFeeLabel}:
              </Typography>
              <Typography variant="body1" color="text.secondary">
                {formatCompactMoney(currentOrder?.serviceFee, locale)}
              </Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-end">
              <Typography variant="h5">{copy.grandTotal}:</Typography>
              <Typography variant="h4" sx={{ lineHeight: 1.05, textAlign: 'right' }}>
                {formatCompactMoney(currentOrder?.total, locale)}
              </Typography>
            </Stack>

            <Stack direction="row" spacing={1.1}>
              <Button
                variant="contained"
                sx={(theme) => ({
                  flex: 1,
                  backgroundImage: 'none',
                  backgroundColor: theme.palette.mode === 'dark' ? '#4d535a' : '#d8cfbf',
                  color: theme.palette.mode === 'dark' ? '#f5f5f5' : theme.palette.text.primary,
                })}
                disabled={isSubmitDisabled}
                onClick={() => submitOrderMutation.mutate()}>
                {submitOrderMutation.isPending ? copy.processing : copy.sendOrder}
              </Button>
              <Button
                variant="contained"
                sx={{ flex: 1.1 }}
                disabled={isSubmitDisabled}
                onClick={() => void handleCheckout()}>
                {copy.goToPayment}
              </Button>
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
                {copy.orders}: {currentOrder ? `A${String(currentOrder.orderNumber).padStart(5, '0')}` : 'A00000'}
              </Typography>
            </Stack>
            <PosIconAction icon="solar:close-circle-bold-duotone" onClick={() => setCartOpen(false)} />
          </Stack>
          <Box sx={{ px: 2, pb: 1.35 }}>
            <PosOrderChannelSegment hallLabel={copy.hall} takeawayLabel={copy.takeaway} channel="takeaway" compact />
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
                        backgroundColor: theme.palette.mode === 'dark' ? '#2d2d2d' : '#ede5d8',
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
                            {item.catalogItemName} (x{item.quantity})
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
                            backgroundColor: theme.palette.mode === 'dark' ? '#383c42' : '#ddd4c7',
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
                          <Typography variant="subtitle1" sx={{ flex: 1, textAlign: 'center' }}>
                            x{item.quantity}
                          </Typography>
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
              onChange={(event) => setKitchenNote(event.target.value)}
              multiline
              minRows={2}
            />
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">
                {copy.subtotal}
              </Typography>
              <Typography variant="body2">{formatCompactMoney(currentOrder?.subtotal, locale)}</Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">
                {serviceFeeLabel}
              </Typography>
              <Typography variant="body2">{formatCompactMoney(currentOrder?.serviceFee, locale)}</Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">
                {copy.grandTotal}
              </Typography>
              <Typography variant="h6">{formatCompactMoney(currentOrder?.total, locale)}</Typography>
            </Stack>
            <Stack direction="row" spacing={1}>
              <Button
                variant="contained"
                sx={(theme) => ({
                  flex: 1,
                  backgroundImage: 'none',
                  backgroundColor: theme.palette.mode === 'dark' ? '#4d535a' : '#d8cfbf',
                  color: theme.palette.mode === 'dark' ? '#f5f5f5' : theme.palette.text.primary,
                })}
                disabled={isSubmitDisabled}
                onClick={() => submitOrderMutation.mutate()}>
                {submitOrderMutation.isPending ? copy.processing : copy.sendOrder}
              </Button>
              <Button
                variant="contained"
                sx={{ flex: 1.1 }}
                disabled={isSubmitDisabled}
                onClick={() => void handleCheckout()}>
                {copy.goToPayment}
              </Button>
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
        onSignOut={() => {
          setSession(null);
          navigate('/pin-login', { replace: true });
        }}
        themeMode={themeMode}
      />
    </PosPageFrame>
  );
}
