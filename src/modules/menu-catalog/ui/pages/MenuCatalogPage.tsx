import { Icon } from '@iconify/react';
import {
  Box,
  Button,
  Divider,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  alpha,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useMemo, useState, type KeyboardEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';

import {
  canAccessTableSessionMenu,
  canAccessTakeawayBuilder,
  getPosHomePath,
  usePosSession,
} from 'modules/auth';
import {
  useCashierBuilderOrdersQuery,
  useCashierMenuQuery,
  cashierKeys,
} from 'modules/cashier/application';
import { cashierRepository } from 'modules/cashier/data-access';
import {
  getCurrentCashierBuilderOrder,
  type CashierBuilderOrderChannel,
  type CashierMenuCategory,
  type CashierMenuItem,
  type CashierOrderItem,
} from 'modules/cashier/domain';
import {
  useCurrentWaiterOrder,
  useWaiterMenuQuery,
  waiterKeys,
} from 'modules/waiter/application';
import { waiterRepository } from 'modules/waiter/data-access';
import type { WaiterMenuCategory, WaiterMenuItem, WaiterOrderItem } from 'modules/waiter/domain';
import { resolveApiBaseUrl } from 'shared/api/apiUrl';
import { PosPageFrame } from 'shared/layout/PosPageFrame';
import { getPosCopy } from 'shared/locale/copy';
import { useOptimisticBuilderOrder } from 'shared/pos/useOptimisticBuilderOrder';
import { PosBuilderPageSkeleton, PosSectionTabs } from 'shared/ui/pos-primitives';

type CatalogMenuItemLike = {
  id: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  image_url?: string | null;
  prepStationName?: string | null;
  price: number | string;
};

type CatalogCategoryLike<TMenuItem extends CatalogMenuItemLike> = {
  id: string;
  name: string;
  items: TMenuItem[];
};

type CatalogOrderItemLike = {
  id: string;
  catalogItem: string;
  catalogItemName: string;
  quantity: number | string;
  status: string;
  prepStationName?: string | null;
  note?: string | null;
};

type CatalogSummaryItem = {
  key: string;
  catalogItem: string;
  catalogItemName: string;
  quantity: number;
  status: string;
  note?: string | null;
  itemIds: string[];
};

type CatalogViewVariant = 'premium' | 'mosaic' | 'menu';

const catalogViewOptions: Array<{ value: CatalogViewVariant; label: string; icon: string }> = [
  { value: 'premium', label: 'Premium', icon: 'solar:stars-bold-duotone' },
  { value: 'mosaic', label: 'Mosaic', icon: 'solar:gallery-wide-bold-duotone' },
  { value: 'menu', label: 'Menu', icon: 'solar:document-text-bold-duotone' },
];

function resolveBuilderChannel(value: string | null): CashierBuilderOrderChannel {
  return value === 'takeaway' ? 'takeaway' : 'delivery';
}

function getDefaultCategory<TMenuItem extends CatalogMenuItemLike>(categories: CatalogCategoryLike<TMenuItem>[]) {
  return categories
    .slice()
    .sort((leftCategory, rightCategory) => rightCategory.items.length - leftCategory.items.length)[0];
}

function resolveMenuItemImageUrl(menuItem: CatalogMenuItemLike) {
  const imageUrl = menuItem.imageUrl ?? menuItem.image_url;

  if (!imageUrl) {
    return null;
  }

  try {
    return new URL(imageUrl, resolveApiBaseUrl()).toString();
  } catch {
    return imageUrl;
  }
}

function createActionKeyHandler(onActivate: () => void) {
  return (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    onActivate();
  };
}

function buildOrderItemMeta(items: CatalogOrderItemLike[] | undefined) {
  const countMap = new Map<string, number>();
  const latestItemMap = new Map<string, string>();

  for (const item of items ?? []) {
    if (item.status === 'cancelled') {
      continue;
    }

    const count = Number(item.quantity ?? 0);
    countMap.set(item.catalogItem, (countMap.get(item.catalogItem) ?? 0) + count);
    latestItemMap.set(item.catalogItem, item.id);
  }

  return { countMap, latestItemMap };
}

function aggregateSummaryItems(items: CatalogOrderItemLike[] | undefined, fallbackStationName: string) {
  const itemMap = new Map<string, CatalogSummaryItem>();

  for (const item of items ?? []) {
    const aggregationKey = [
      item.catalogItem,
      item.note ?? '',
      item.status,
      item.prepStationName ?? fallbackStationName,
    ].join('::');
    const existing = itemMap.get(aggregationKey);

    if (existing) {
      existing.quantity += Number(item.quantity ?? 0);
      existing.itemIds.push(item.id);
      continue;
    }

    itemMap.set(aggregationKey, {
      key: aggregationKey,
      catalogItem: item.catalogItem,
      catalogItemName: item.catalogItemName,
      quantity: Number(item.quantity ?? 0),
      status: item.status,
      note: item.note,
      itemIds: [item.id],
    });
  }

  return Array.from(itemMap.values()).filter((item) => item.status !== 'cancelled');
}

function PriceHiddenCatalogContent<TMenuItem extends CatalogMenuItemLike>({
  categories,
  orderItems,
  isLoading,
  hasPendingOperations,
  returnPath,
  addItem,
  removeItem,
}: {
  categories: CatalogCategoryLike<TMenuItem>[];
  orderItems: CatalogOrderItemLike[] | undefined;
  isLoading: boolean;
  hasPendingOperations: boolean;
  returnPath: string;
  addItem: (menuItem: TMenuItem, note: string) => void;
  removeItem: (itemId: string) => void;
}) {
  const navigate = useNavigate();
  const { locale } = usePosSession();
  const copy = getPosCopy(locale);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [viewVariant, setViewVariant] = useState<CatalogViewVariant>('premium');

  const defaultCategory = useMemo(() => getDefaultCategory(categories), [categories]);
  const selectedCategory = categories.find((category) => category.id === selectedCategoryId) ?? defaultCategory;
  const { countMap, latestItemMap } = useMemo(() => buildOrderItemMeta(orderItems), [orderItems]);
  const menuItemById = useMemo(
    () => new Map(categories.flatMap((category) => category.items.map((menuItem) => [menuItem.id, menuItem] as const))),
    [categories],
  );
  const selectedItems = useMemo(() => aggregateSummaryItems(orderItems, copy.menu), [copy.menu, orderItems]);
  const selectedCount = selectedItems.reduce((sum, item) => sum + item.quantity, 0);
  const categoryTabs = useMemo(
    () =>
      categories.map((category) => ({
        value: category.id,
        label: category.name,
        count: category.items.reduce((totalCount, menuItem) => totalCount + (countMap.get(menuItem.id) ?? 0), 0),
      })),
    [categories, countMap],
  );

  if (isLoading) {
    return <PosBuilderPageSkeleton mobile={isMobile} />;
  }

  const selectedCategoryItems = selectedCategory?.items ?? [];
  const featuredItem = selectedCategoryItems[0];
  const secondaryItems = selectedCategoryItems.slice(1);
  const isShowcase = viewVariant === 'premium';
  const isGallery = viewVariant === 'mosaic';
  const isCompact = viewVariant === 'menu';

  const renderControls = (menuItem: TMenuItem, selectedCountForItem: number, compact = false) => (
    <Stack direction="row" spacing={0.8} alignItems="center">
      {selectedCountForItem > 0 ? (
        <Button
          aria-label={`Remove ${menuItem.name}`}
          variant="contained"
          disabled={hasPendingOperations}
          onClick={(event) => {
            event.stopPropagation();
            const latestItemId = latestItemMap.get(menuItem.id);
            if (latestItemId) {
              removeItem(latestItemId);
            }
          }}
          sx={(theme) => ({
            minWidth: compact ? 38 : 42,
            width: compact ? 38 : 42,
            height: compact ? 38 : 42,
            px: 0,
            borderRadius: '999px',
            color: theme.palette.mode === 'dark' ? '#ffffff' : '#17201d',
            backgroundColor: theme.palette.mode === 'dark' ? alpha('#ffffff', 0.13) : alpha('#ffffff', 0.9),
            backgroundImage: 'none',
            boxShadow: 'none',
            '&:hover': {
              backgroundColor: theme.palette.mode === 'dark' ? alpha('#ffffff', 0.2) : '#ffffff',
              boxShadow: 'none',
            },
          })}>
          <Icon icon="solar:minus-circle-bold" width={20} />
        </Button>
      ) : null}
      <Button
        aria-label={`Add one ${menuItem.name}`}
        variant="contained"
        disabled={hasPendingOperations}
        onClick={(event) => {
          event.stopPropagation();
          addItem(menuItem, '');
        }}
        sx={(theme) => ({
          minWidth: compact ? 38 : selectedCountForItem > 0 ? 42 : 96,
          width: selectedCountForItem > 0 ? (compact ? 38 : 42) : undefined,
          height: compact ? 38 : 42,
          px: selectedCountForItem > 0 ? 0 : 1.5,
          borderRadius: '999px',
          color: '#ffffff',
          backgroundColor: theme.palette.mode === 'dark' ? '#5c7f6c' : '#1f6b4f',
          backgroundImage: 'none',
          boxShadow: '0 10px 20px rgba(31,107,79,0.24)',
          '&:hover': {
            backgroundColor: theme.palette.mode === 'dark' ? '#6d907d' : '#17573f',
            boxShadow: '0 12px 24px rgba(31,107,79,0.3)',
          },
        })}>
        <Icon icon="solar:add-circle-bold" width={20} />
        {selectedCountForItem > 0 ? null : (
          <Typography component="span" sx={{ ml: 0.6, fontWeight: 800 }}>
            Tanlash
          </Typography>
        )}
      </Button>
    </Stack>
  );

  const renderCountBadge = (selectedCountForItem: number, tone: 'dark' | 'light' = 'dark') =>
    selectedCountForItem > 0 ? (
      <Box
        sx={{
          minWidth: 34,
          height: 34,
          px: 1,
          borderRadius: '999px',
          display: 'grid',
          placeItems: 'center',
          fontSize: 15,
          fontWeight: 900,
          color: tone === 'dark' ? '#ffffff' : '#17201d',
          backgroundColor: tone === 'dark' ? '#17201d' : alpha('#ffffff', 0.92),
          boxShadow: '0 10px 20px rgba(0,0,0,0.2)',
        }}>
        {selectedCountForItem}
      </Box>
    ) : null;

  const renderVisual = (
    menuItem: TMenuItem,
    options: { height?: number | string | Record<string, number | string>; overlay?: boolean } = {},
  ) => {
    const imageUrl = resolveMenuItemImageUrl(menuItem);

    if (imageUrl) {
      return (
        <Box
          component="img"
          src={imageUrl}
          alt={menuItem.name}
          loading="lazy"
          sx={{
            width: '100%',
            height: options.height ?? '100%',
            minHeight: 0,
            display: 'block',
            objectFit: 'cover',
            filter: options.overlay ? 'saturate(1.04) contrast(1.02)' : undefined,
          }}
        />
      );
    }

    return (
      <Box
        sx={(theme) => ({
          width: '100%',
          height: options.height ?? '100%',
          minHeight: 0,
          display: 'grid',
          placeItems: 'center',
          color: theme.palette.mode === 'dark' ? alpha('#ffffff', 0.66) : alpha('#193327', 0.62),
          background:
            theme.palette.mode === 'dark'
              ? 'linear-gradient(135deg, #26352e 0%, #151a1f 100%)'
              : 'linear-gradient(135deg, #eef0dc 0%, #d8eadc 46%, #f7efe4 100%)',
        })}>
        <Icon icon="solar:chef-hat-bold-duotone" width={52} />
      </Box>
    );
  };

  const renderPremiumCard = (menuItem: TMenuItem, featured = false) => {
    const selectedCountForItem = countMap.get(menuItem.id) ?? 0;

    return (
      <Box
        key={menuItem.id}
        role="button"
        tabIndex={0}
        aria-label={`Add ${menuItem.name}`}
        onClick={() => addItem(menuItem, '')}
        onKeyDown={createActionKeyHandler(() => addItem(menuItem, ''))}
        sx={(theme) => ({
          position: 'relative',
          overflow: 'hidden',
          borderRadius: featured ? '18px' : '14px',
          minHeight: featured ? { xs: 320, md: 400 } : { xs: 236, md: 276 },
          display: 'grid',
          gridTemplateRows: featured ? '1fr' : 'minmax(132px, 1fr) auto',
          cursor: 'pointer',
          backgroundColor: theme.palette.mode === 'dark' ? '#20251f' : '#fffdf7',
          boxShadow:
            theme.palette.mode === 'dark'
              ? '0 18px 36px rgba(0,0,0,0.28), inset 0 0 0 1px rgba(255,255,255,0.06)'
              : '0 18px 38px rgba(47,62,42,0.12), inset 0 0 0 1px rgba(47,62,42,0.08)',
          transition: 'transform 0.16s ease, box-shadow 0.16s ease',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow:
              theme.palette.mode === 'dark'
                ? '0 22px 42px rgba(0,0,0,0.34), inset 0 0 0 1px rgba(255,255,255,0.1)'
                : '0 22px 42px rgba(47,62,42,0.16), inset 0 0 0 1px rgba(47,62,42,0.1)',
          },
          '&:focus-visible': {
            outline: `2px solid ${theme.palette.primary.main}`,
            outlineOffset: 2,
          },
        })}>
        {featured ? (
          <>
            {renderVisual(menuItem, { overlay: true })}
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(180deg, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0.68) 100%)',
              }}
            />
            <Stack
              spacing={1.2}
              justifyContent="flex-end"
              sx={{
                position: 'absolute',
                inset: 0,
                p: { xs: 2, md: 2.6 },
                color: '#ffffff',
              }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1.5}>
                <Typography variant="body2" sx={{ opacity: 0.82, fontWeight: 700 }}>
                  {menuItem.prepStationName ?? copy.menu}
                </Typography>
                {renderCountBadge(selectedCountForItem, 'light')}
              </Stack>
              <Typography variant="h3" sx={{ lineHeight: 1.02, maxWidth: 560 }}>
                {menuItem.name}
              </Typography>
              {menuItem.description ? (
                <Typography variant="body1" sx={{ maxWidth: 620, opacity: 0.84 }}>
                  {menuItem.description}
                </Typography>
              ) : null}
              {renderControls(menuItem, selectedCountForItem)}
            </Stack>
          </>
        ) : (
          <>
            <Box sx={{ position: 'relative', minHeight: 0 }}>
              {renderVisual(menuItem)}
              <Box sx={{ position: 'absolute', top: 12, right: 12 }}>{renderCountBadge(selectedCountForItem)}</Box>
            </Box>
            <Stack spacing={0.8} sx={{ p: 1.6 }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700 }}>
                {menuItem.prepStationName ?? copy.menu}
              </Typography>
              <Typography variant="h6" sx={{ lineHeight: 1.15 }}>
                {menuItem.name}
              </Typography>
              {menuItem.description ? (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitBoxOrient: 'vertical',
                    WebkitLineClamp: 2,
                  }}>
                  {menuItem.description}
                </Typography>
              ) : null}
              {renderControls(menuItem, selectedCountForItem)}
            </Stack>
          </>
        )}
      </Box>
    );
  };

  const renderMosaicCard = (menuItem: TMenuItem, index: number) => {
    const selectedCountForItem = countMap.get(menuItem.id) ?? 0;
    const isLarge = index % 5 === 0 || index % 5 === 3;

    return (
      <Box
        key={menuItem.id}
        role="button"
        tabIndex={0}
        aria-label={`Add ${menuItem.name}`}
        onClick={() => addItem(menuItem, '')}
        onKeyDown={createActionKeyHandler(() => addItem(menuItem, ''))}
        sx={(theme) => ({
          position: 'relative',
          overflow: 'hidden',
          borderRadius: '16px',
          minHeight: isLarge ? { xs: 300, md: 360 } : { xs: 220, md: 250 },
          gridColumn: { xs: 'auto', md: isLarge ? 'span 2' : 'auto' },
          cursor: 'pointer',
          backgroundColor: theme.palette.mode === 'dark' ? '#202228' : '#f8f2e8',
          boxShadow:
            theme.palette.mode === 'dark'
              ? '0 18px 34px rgba(0,0,0,0.26)'
              : '0 18px 36px rgba(50,46,38,0.14)',
          transition: 'transform 0.16s ease, box-shadow 0.16s ease',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow:
              theme.palette.mode === 'dark'
                ? '0 22px 40px rgba(0,0,0,0.34)'
                : '0 24px 44px rgba(50,46,38,0.18)',
          },
          '&:focus-visible': {
            outline: `2px solid ${theme.palette.primary.main}`,
            outlineOffset: 2,
          },
        })}>
        {renderVisual(menuItem, { overlay: true })}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(180deg, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.12) 42%, rgba(0,0,0,0.76) 100%)',
          }}
        />
        <Stack
          spacing={1}
          justifyContent="space-between"
          sx={{ position: 'absolute', inset: 0, p: { xs: 1.55, md: 1.9 }, color: '#ffffff' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
            <Typography variant="body2" sx={{ fontWeight: 800, opacity: 0.84 }}>
              {menuItem.prepStationName ?? copy.menu}
            </Typography>
            {renderCountBadge(selectedCountForItem, 'light')}
          </Stack>
          <Stack spacing={1}>
            <Typography variant={isLarge ? 'h4' : 'h5'} sx={{ lineHeight: 1.04 }}>
              {menuItem.name}
            </Typography>
            {menuItem.description ? (
              <Typography
                variant="body2"
                sx={{
                  opacity: 0.82,
                  overflow: 'hidden',
                  display: '-webkit-box',
                  WebkitBoxOrient: 'vertical',
                  WebkitLineClamp: 2,
                }}>
                {menuItem.description}
              </Typography>
            ) : null}
            {renderControls(menuItem, selectedCountForItem)}
          </Stack>
        </Stack>
      </Box>
    );
  };

  const renderMenuRow = (menuItem: TMenuItem) => {
    const selectedCountForItem = countMap.get(menuItem.id) ?? 0;

    return (
      <Box
        key={menuItem.id}
        role="button"
        tabIndex={0}
        aria-label={`Add ${menuItem.name}`}
        onClick={() => addItem(menuItem, '')}
        onKeyDown={createActionKeyHandler(() => addItem(menuItem, ''))}
        sx={(theme) => ({
          display: 'grid',
          gridTemplateColumns: { xs: '74px minmax(0, 1fr)', md: '96px minmax(0, 1fr) auto' },
          gap: { xs: 1.2, md: 1.6 },
          alignItems: 'center',
          p: { xs: 1.1, md: 1.35 },
          borderRadius: '14px',
          cursor: 'pointer',
          backgroundColor: theme.palette.mode === 'dark' ? alpha('#ffffff', 0.055) : alpha('#ffffff', 0.66),
          boxShadow:
            theme.palette.mode === 'dark'
              ? 'inset 0 0 0 1px rgba(255,255,255,0.07)'
              : 'inset 0 0 0 1px rgba(42,51,36,0.08)',
          transition: 'background-color 0.16s ease, transform 0.16s ease',
          '&:hover': {
            transform: 'translateX(2px)',
            backgroundColor: theme.palette.mode === 'dark' ? alpha('#ffffff', 0.085) : '#ffffff',
          },
          '&:focus-visible': {
            outline: `2px solid ${theme.palette.primary.main}`,
            outlineOffset: 2,
          },
        })}>
        <Box sx={{ height: { xs: 74, md: 86 }, borderRadius: '12px', overflow: 'hidden' }}>
          {renderVisual(menuItem)}
        </Box>
        <Stack spacing={0.45} sx={{ minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="h6" noWrap sx={{ lineHeight: 1.15 }}>
              {menuItem.name}
            </Typography>
            {renderCountBadge(selectedCountForItem)}
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700 }}>
            {menuItem.prepStationName ?? copy.menu}
          </Typography>
          {menuItem.description ? (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitBoxOrient: 'vertical',
                WebkitLineClamp: 2,
              }}>
              {menuItem.description}
            </Typography>
          ) : null}
        </Stack>
        <Box sx={{ display: { xs: 'none', md: 'block' } }}>
          {renderControls(menuItem, selectedCountForItem, true)}
        </Box>
      </Box>
    );
  };

  return (
    <PosPageFrame
      sx={{
        mx: { xs: -0.2, md: -0.6 },
        pb: 0,
      }}
      contentSx={{ overflow: 'hidden' }}
      header={
        <Stack spacing={{ xs: 1.2, md: 1.5 }}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={{ xs: 1.1, md: 1.5 }}
            alignItems={{ xs: 'stretch', md: 'center' }}
            justifyContent="space-between">
            <Button
              variant="text"
              disabled={hasPendingOperations}
              startIcon={<Icon icon="solar:arrow-left-bold-duotone" width={18} />}
              onClick={() => navigate(returnPath)}
              sx={(theme) => ({
                alignSelf: { xs: 'flex-start', md: 'center' },
                px: 1.25,
                py: 0.85,
                minWidth: 0,
                borderRadius: '999px',
                color: theme.palette.text.primary,
                backgroundColor: theme.palette.mode === 'dark' ? alpha('#ffffff', 0.06) : alpha('#ffffff', 0.48),
                boxShadow:
                  theme.palette.mode === 'dark'
                    ? 'inset 0 0 0 1px rgba(255,255,255,0.08)'
                    : 'inset 0 0 0 1px rgba(60,48,34,0.08)',
                '&:hover': {
                  backgroundColor: theme.palette.mode === 'dark' ? alpha('#ffffff', 0.1) : alpha('#ffffff', 0.72),
                },
              })}>
              {hasPendingOperations ? copy.processing : 'Orqaga'}
            </Button>
            <Stack spacing={0.25} sx={{ minWidth: 0, flex: 1, textAlign: { xs: 'left', md: 'center' } }}>
              <Typography variant="h4" sx={{ lineHeight: 1.05 }}>
                {selectedCategory?.name ?? copy.menu}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {selectedCount > 0 ? `${selectedCount} ta tanlangan` : 'Klient uchun narxsiz katalog'}
              </Typography>
            </Stack>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={viewVariant}
              onChange={(_, value: CatalogViewVariant | null) => {
                if (value) {
                  setViewVariant(value);
                }
              }}
              sx={(theme) => ({
                alignSelf: { xs: 'stretch', md: 'center' },
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                borderRadius: '999px',
                p: 0.35,
                backgroundColor: theme.palette.mode === 'dark' ? alpha('#ffffff', 0.06) : alpha('#ffffff', 0.5),
                boxShadow:
                  theme.palette.mode === 'dark'
                    ? 'inset 0 0 0 1px rgba(255,255,255,0.08)'
                    : 'inset 0 0 0 1px rgba(60,48,34,0.08)',
                '& .MuiToggleButton-root': {
                  border: 0,
                  borderRadius: '999px !important',
                  px: { xs: 0.7, md: 1.2 },
                  py: 0.75,
                  gap: 0.55,
                  minWidth: 0,
                  fontWeight: 700,
                  color: theme.palette.text.secondary,
                },
                '& .Mui-selected': {
                  color: theme.palette.mode === 'dark' ? '#ffffff' : '#1f252b',
                  backgroundColor: theme.palette.mode === 'dark' ? '#3a4048 !important' : '#ffffff !important',
                  boxShadow: '0 8px 18px rgba(42,31,19,0.1)',
                },
              })}>
              {catalogViewOptions.map((option) => (
                <ToggleButton key={option.value} value={option.value} aria-label={option.label}>
                  <Icon icon={option.icon} width={17} />
                  <Typography component="span" sx={{ display: { xs: 'none', sm: 'inline' }, fontWeight: 700 }}>
                    {option.label}
                  </Typography>
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Stack>
          <PosSectionTabs
            value={selectedCategory?.id ?? ''}
            items={categoryTabs}
            onChange={setSelectedCategoryId}
            scrollable
          />
        </Stack>
      }>
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 330px' },
          gap: { xs: 2, md: 2.5 },
        }}>
        <Stack spacing={2} sx={{ minHeight: 0, overflowY: 'auto', overflowX: 'hidden', pb: 1 }}>
          {viewVariant === 'premium' ? (
            <Stack spacing={{ xs: 1.4, md: 1.8 }}>
              {featuredItem ? renderPremiumCard(featuredItem, true) : null}
              {secondaryItems.length > 0 ? (
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: '1fr',
                      sm: 'repeat(2, minmax(0, 1fr))',
                      xl: 'repeat(3, minmax(0, 1fr))',
                    },
                    gap: { xs: 1.3, md: 1.7 },
                  }}>
                  {secondaryItems.map((menuItem) => renderPremiumCard(menuItem))}
                </Box>
              ) : null}
            </Stack>
          ) : viewVariant === 'mosaic' ? (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
                gridAutoRows: 'minmax(220px, auto)',
                gap: { xs: 1.35, md: 1.7 },
              }}>
              {selectedCategoryItems.map((menuItem, index) => renderMosaicCard(menuItem, index))}
            </Box>
          ) : (
            <Stack
              spacing={1.1}
              sx={(theme) => ({
                borderRadius: '18px',
                p: { xs: 1, md: 1.25 },
                backgroundColor: theme.palette.mode === 'dark' ? alpha('#111418', 0.28) : alpha('#ffffff', 0.36),
                boxShadow:
                  theme.palette.mode === 'dark'
                    ? 'inset 0 0 0 1px rgba(255,255,255,0.05)'
                    : 'inset 0 0 0 1px rgba(42,51,36,0.08)',
              })}>
              {selectedCategoryItems.map((menuItem) => renderMenuRow(menuItem))}
            </Stack>
          )}
          <Box
            sx={{
              display: 'none',
              gridTemplateColumns: isCompact
                ? { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' }
                : isGallery
                  ? { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' }
                  : { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))', xl: 'repeat(4, minmax(0, 1fr))' },
              gap: { xs: 1.2, md: 1.6 },
            }}>
            {(selectedCategory?.items ?? []).map((menuItem) => {
              const selectedCount = countMap.get(menuItem.id) ?? 0;
              const imageUrl = resolveMenuItemImageUrl(menuItem);

              return (
                <Box
                  key={menuItem.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Add ${menuItem.name}`}
                  onClick={() => addItem(menuItem, '')}
                  onKeyDown={createActionKeyHandler(() => addItem(menuItem, ''))}
                  sx={(theme) => ({
                    minHeight: isCompact ? { xs: 104, md: 118 } : isGallery ? { xs: 142, md: 154 } : { xs: 222, md: 286 },
                    position: 'relative',
                    overflow: 'hidden',
                    display: isShowcase ? 'block' : 'grid',
                    gridTemplateColumns: isCompact ? 'minmax(0, 1fr) auto' : { xs: '108px minmax(0, 1fr)', md: '130px minmax(0, 1fr)' },
                    alignItems: 'stretch',
                    borderRadius: isShowcase ? '14px' : '12px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    backgroundColor: theme.palette.mode === 'dark' ? '#25282d' : '#fffaf2',
                    boxShadow:
                      theme.palette.mode === 'dark'
                        ? 'inset 0 0 0 1px rgba(255,255,255,0.07)'
                        : '0 10px 24px rgba(69,50,29,0.08), inset 0 0 0 1px rgba(55,44,30,0.07)',
                    transition: 'transform 0.16s ease, box-shadow 0.16s ease, background-color 0.16s ease',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      backgroundColor: theme.palette.mode === 'dark' ? '#2d3137' : '#ffffff',
                      boxShadow:
                        theme.palette.mode === 'dark'
                          ? '0 16px 28px rgba(0,0,0,0.26), inset 0 0 0 1px rgba(255,255,255,0.08)'
                          : '0 18px 36px rgba(69,50,29,0.14), inset 0 0 0 1px rgba(55,44,30,0.1)',
                    },
                    '&:active': {
                      transform: 'translateY(0) scale(0.985)',
                    },
                    '&:focus-visible': {
                      outline: `2px solid ${theme.palette.primary.main}`,
                      outlineOffset: 2,
                    },
                  })}>
                  {selectedCount > 0 ? (
                    <Box
                      sx={(theme) => ({
                        position: 'absolute',
                        top: isCompact ? 12 : 10,
                        left: isCompact ? 'auto' : 10,
                        right: isCompact ? 12 : 'auto',
                        zIndex: 2,
                        minWidth: 34,
                        height: 34,
                        px: 1,
                        borderRadius: '50%',
                        backgroundColor: theme.palette.mode === 'dark' ? '#111418' : '#202020',
                        color: '#ffffff',
                        display: 'grid',
                        placeItems: 'center',
                        fontSize: 15,
                        fontWeight: 800,
                        boxShadow: '0 10px 20px rgba(0,0,0,0.24)',
                      })}>
                      {selectedCount}
                    </Box>
                  ) : null}
                  {!isCompact ? (
                    imageUrl ? (
                      <Box
                        component="img"
                        src={imageUrl}
                        alt={menuItem.name}
                        loading="lazy"
                        sx={{
                          width: '100%',
                          height: isGallery ? '100%' : undefined,
                          aspectRatio: isShowcase ? '4 / 3' : undefined,
                          display: 'block',
                          objectFit: 'cover',
                          backgroundColor: alpha('#ffffff', 0.22),
                        }}
                      />
                    ) : (
                      <Box
                        sx={(theme) => ({
                          width: '100%',
                          height: isGallery ? '100%' : undefined,
                          aspectRatio: isShowcase ? '4 / 3' : undefined,
                          display: 'grid',
                          placeItems: 'center',
                          background:
                            theme.palette.mode === 'dark'
                              ? 'linear-gradient(135deg, #343941, #252a31)'
                              : 'linear-gradient(135deg, #eadcc9, #f7efe4)',
                          color: theme.palette.text.secondary,
                        })}>
                        <Icon icon="solar:chef-hat-bold-duotone" width={isGallery ? 32 : 46} />
                      </Box>
                    )
                  ) : null}
                  <Stack
                    spacing={isCompact ? 0.55 : 0.8}
                    justifyContent={isCompact ? 'center' : 'flex-start'}
                    sx={{
                      minWidth: 0,
                      p: isCompact ? { xs: 1.35, md: 1.55 } : { xs: 1.35, md: 1.7 },
                      pr: isCompact && selectedCount > 0 ? 6 : undefined,
                    }}>
                    <Typography variant="body2" color="text.secondary">
                      {menuItem.prepStationName ?? copy.menu}
                    </Typography>
                    <Typography variant={isCompact ? 'subtitle1' : 'h6'} sx={{ lineHeight: 1.18 }}>
                      {menuItem.name}
                    </Typography>
                    {menuItem.description ? (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          overflow: 'hidden',
                          display: '-webkit-box',
                          WebkitBoxOrient: 'vertical',
                          WebkitLineClamp: isCompact ? 1 : 2,
                        }}>
                        {menuItem.description}
                      </Typography>
                    ) : null}
                  </Stack>
                  <Stack
                    direction={isCompact ? 'column' : 'row'}
                    spacing={isCompact ? 0.75 : 1}
                    justifyContent="center"
                    sx={{
                      px: isCompact ? 1.15 : { xs: 1.25, md: 1.6 },
                      py: isCompact ? 1.15 : undefined,
                      pb: isCompact ? 1.15 : { xs: 1.25, md: 1.6 },
                      mt: isShowcase ? 'auto' : undefined,
                    }}>
                    {selectedCount > 0 ? (
                      <Button
                        aria-label={`Remove ${menuItem.name}`}
                        variant="contained"
                        disabled={hasPendingOperations}
                        onClick={(event) => {
                          event.stopPropagation();
                          const latestItemId = latestItemMap.get(menuItem.id);
                          if (latestItemId) {
                            removeItem(latestItemId);
                          }
                        }}
                        sx={{ minWidth: isCompact ? 40 : 44, width: isCompact ? 40 : undefined, px: 0, borderRadius: '999px' }}>
                        <Icon icon="solar:minus-circle-bold" width={20} />
                      </Button>
                    ) : null}
                    <Button
                      aria-label={`Add one ${menuItem.name}`}
                      variant="contained"
                      disabled={hasPendingOperations}
                      onClick={(event) => {
                        event.stopPropagation();
                        addItem(menuItem, '');
                      }}
                      sx={{ flex: isCompact ? '0 0 auto' : 1, minWidth: isCompact ? 40 : 0, width: isCompact ? 40 : undefined, px: 0, borderRadius: '999px' }}>
                      <Icon icon="solar:add-circle-bold" width={20} />
                    </Button>
                  </Stack>
                </Box>
              );
            })}
          </Box>
        </Stack>

        <Box
          sx={(theme) => ({
            borderRadius: '12px',
            overflow: 'hidden',
            minHeight: 0,
            display: { xs: 'none', lg: 'flex' },
            flexDirection: 'column',
            backgroundColor: theme.palette.mode === 'dark' ? alpha('#26282c', 0.82) : alpha('#fffaf2', 0.8),
            backdropFilter: 'blur(16px)',
            boxShadow:
              theme.palette.mode === 'dark'
                ? 'inset 0 0 0 1px rgba(255,255,255,0.06)'
                : 'inset 0 0 0 1px rgba(65,48,28,0.08)',
          })}>
          <Stack spacing={0.3} sx={{ p: 2 }}>
            <Typography variant="h6">Tanlanganlar</Typography>
            <Typography variant="body2" color="text.secondary">
              {selectedCount} {copy.menu}
            </Typography>
          </Stack>
          <Divider />
          <Stack spacing={1} sx={{ p: 1.5, overflowY: 'auto' }}>
            {selectedItems.length > 0 ? (
              selectedItems.map((item) => {
                const menuItem = menuItemById.get(item.catalogItem);

                return (
                  <Box
                    key={item.key}
                    sx={(theme) => ({
                      borderRadius: '10px',
                      backgroundColor: theme.palette.mode === 'dark' ? '#33373d' : '#fff8ee',
                      overflow: 'hidden',
                    })}>
                    <Stack direction="row" spacing={1.2} alignItems="center" sx={{ p: 1.25 }}>
                      <Stack sx={{ flex: 1, minWidth: 0 }} spacing={0.2}>
                        <Typography variant="subtitle2" noWrap>
                          {item.catalogItemName}
                        </Typography>
                        {item.note ? (
                          <Typography variant="caption" color="text.secondary" noWrap>
                            {item.note}
                          </Typography>
                        ) : null}
                      </Stack>
                      <Typography variant="h6" sx={{ minWidth: 36, textAlign: 'center' }}>
                        x{item.quantity}
                      </Typography>
                    </Stack>
                    {menuItem ? (
                      <Stack direction="row" spacing={1} sx={{ px: 1.25, pb: 1.25 }}>
                        <Button
                          aria-label={`Remove selected ${item.catalogItemName}`}
                          variant="contained"
                          disabled={hasPendingOperations}
                          onClick={() => {
                            const latestItemId = item.itemIds[item.itemIds.length - 1];
                            removeItem(latestItemId);
                          }}
                          sx={{ minWidth: 48, px: 0 }}>
                          <Icon icon="solar:minus-circle-bold" width={18} />
                        </Button>
                        <Button
                          aria-label={`Add selected ${item.catalogItemName}`}
                          variant="contained"
                          disabled={hasPendingOperations}
                          onClick={() => addItem(menuItem, item.note ?? '')}
                          sx={{ flex: 1, minWidth: 0 }}>
                          <Icon icon="solar:add-circle-bold" width={18} />
                        </Button>
                      </Stack>
                    ) : null}
                  </Box>
                );
              })
            ) : (
              <Stack sx={{ py: 8, textAlign: 'center' }} spacing={1}>
                <Typography variant="h6">{copy.emptyOrder}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {copy.chooseFromMenu}
                </Typography>
              </Stack>
            )}
          </Stack>
        </Box>

        <Stack
          spacing={1}
          sx={{
            display: { xs: 'flex', lg: 'none' },
            maxHeight: '34dvh',
            overflowY: 'auto',
            pb: 0.5,
          }}>
          <Typography variant="subtitle1">Tanlanganlar: {selectedCount}</Typography>
          {selectedItems.slice(0, 6).map((item) => (
            <Stack
              key={item.key}
              direction="row"
              spacing={1}
              alignItems="center"
              sx={(theme) => ({
                borderRadius: '10px',
                px: 1.2,
                py: 0.95,
                backgroundColor: theme.palette.mode === 'dark' ? alpha('#ffffff', 0.06) : alpha('#ffffff', 0.56),
              })}>
              <Typography variant="body2" noWrap sx={{ flex: 1 }}>
                {item.catalogItemName}
              </Typography>
              <Typography variant="subtitle2">x{item.quantity}</Typography>
            </Stack>
          ))}
        </Stack>
      </Box>
    </PosPageFrame>
  );
}

function WaiterMenuCatalogPage({ sessionId }: { sessionId: string | null }) {
  const { locale, session } = usePosSession();
  const canViewMenu = canAccessTableSessionMenu(session?.user);
  const menuQuery = useWaiterMenuQuery({ enabled: canViewMenu && Boolean(sessionId) });
  const orderQuery = useCurrentWaiterOrder(sessionId);
  const copy = getPosCopy(locale);
  const { currentOrder, addItem, removeItem, hasPendingOperations } = useOptimisticBuilderOrder<
    WaiterMenuItem,
    WaiterOrderItem,
    NonNullable<typeof orderQuery.currentOrder>,
    Awaited<ReturnType<typeof waiterRepository.getOrders>>
  >({
    baseOrder: orderQuery.currentOrder,
    canonicalQueryKey: waiterKeys.orders,
    canonicalQueryFn: () => waiterRepository.getOrders(),
    channel: 'hall',
    createOrder: async (note) => {
      const response = await waiterRepository.createOrder(sessionId as string, note);
      return response.id;
    },
    defaultServiceFeeEnabled: Boolean(session?.restaurantContext?.serviceFeeEnabled),
    defaultServiceFeePercent: Number(session?.restaurantContext?.serviceFeePercent ?? 0),
    defaultVatEnabled: Boolean(session?.restaurantContext?.vatEnabled),
    defaultVatPercent: session?.restaurantContext?.vatPercent ?? 0,
    removeOrderItem: (itemId) => waiterRepository.removeOrderItem(itemId),
    selectCurrentOrder: (orders) =>
      orders.find((order) => order.tableSession === sessionId && !['closed', 'cancelled'].includes(order.status)),
    addOrderItem: (orderId, menuItem, note) => waiterRepository.addOrderItem(orderId, menuItem.id, note),
    syncErrorMessage: copy.itemSyncFailed,
  });

  if (!sessionId || !canViewMenu) {
    return <Navigate to={getPosHomePath(session)} replace />;
  }

  return (
    <PriceHiddenCatalogContent
      categories={(menuQuery.data ?? []) as Array<WaiterMenuCategory & CatalogCategoryLike<WaiterMenuItem>>}
      orderItems={currentOrder?.items}
      isLoading={menuQuery.isLoading && !menuQuery.data}
      hasPendingOperations={hasPendingOperations}
      returnPath={`/waiter/table-session?sessionId=${encodeURIComponent(sessionId)}`}
      addItem={addItem}
      removeItem={removeItem}
    />
  );
}

function CashierMenuCatalogPage({ channel }: { channel: CashierBuilderOrderChannel }) {
  const { locale, session } = usePosSession();
  const canViewMenu = canAccessTakeawayBuilder(session?.user);
  const menuQuery = useCashierMenuQuery();
  const ordersQuery = useCashierBuilderOrdersQuery();
  const serverOrder = useMemo(
    () => getCurrentCashierBuilderOrder(ordersQuery.data, session?.user.id, channel),
    [channel, ordersQuery.data, session?.user.id],
  );
  const copy = getPosCopy(locale);
  const { currentOrder, addItem, removeItem, hasPendingOperations } = useOptimisticBuilderOrder({
    baseOrder: serverOrder,
    canonicalQueryKey: cashierKeys.builderOrders,
    canonicalQueryFn: () => cashierRepository.getOpenOrders(),
    channel,
    createOrder: async (note) => {
      const response = await cashierRepository.createBuilderOrder({ channel, note });
      return response.id;
    },
    defaultServiceFeeEnabled: Boolean(session?.restaurantContext?.serviceFeeEnabled),
    defaultServiceFeePercent: Number(session?.restaurantContext?.serviceFeePercent ?? 0),
    defaultVatEnabled: Boolean(session?.restaurantContext?.vatEnabled),
    defaultVatPercent: session?.restaurantContext?.vatPercent ?? 0,
    removeOrderItem: (itemId) => cashierRepository.removeOrderItem(itemId),
    resetKey: channel,
    selectCurrentOrder: (orders) => getCurrentCashierBuilderOrder(orders, session?.user.id, channel),
    addOrderItem: (orderId, menuItem, note) => cashierRepository.addOrderItem(orderId, menuItem.id, note),
    syncErrorMessage: copy.itemSyncFailed,
  });

  if (!canViewMenu) {
    return <Navigate to={getPosHomePath(session)} replace />;
  }

  return (
    <PriceHiddenCatalogContent
      categories={(menuQuery.data ?? []) as Array<CashierMenuCategory & CatalogCategoryLike<CashierMenuItem>>}
      orderItems={currentOrder?.items as CashierOrderItem[] | undefined}
      isLoading={(menuQuery.isLoading && !menuQuery.data) || (ordersQuery.isLoading && !ordersQuery.data)}
      hasPendingOperations={hasPendingOperations}
      returnPath={`/cashier/builder?channel=${channel}`}
      addItem={addItem}
      removeItem={removeItem}
    />
  );
}

export function MenuCatalogPage() {
  const [searchParams] = useSearchParams();
  const { session } = usePosSession();
  const source = searchParams.get('source');

  if (source === 'waiter') {
    return <WaiterMenuCatalogPage sessionId={searchParams.get('sessionId')} />;
  }

  if (source === 'cashier') {
    return <CashierMenuCatalogPage channel={resolveBuilderChannel(searchParams.get('channel'))} />;
  }

  return <Navigate to={getPosHomePath(session)} replace />;
}
