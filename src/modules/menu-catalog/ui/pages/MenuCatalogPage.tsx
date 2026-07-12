import { Icon } from '@iconify/react';
import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Stack,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useMemo, useState, type KeyboardEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';

import { canAccessTableSessionMenu, canAccessTakeawayBuilder, getPosHomePath, usePosSession } from 'modules/auth';
import { cashierKeys, useCashierBuilderOrdersQuery, useCashierMenuQuery } from 'modules/cashier/application';
import { cashierRepository } from 'modules/cashier/data-access';
import {
  getCurrentCashierBuilderOrder,
  type CashierBuilderOrderChannel,
  type CashierMenuCategory,
  type CashierMenuItem,
  type CashierOrderItem,
} from 'modules/cashier/domain';
import { useCurrentWaiterOrder, useWaiterMenuQuery, waiterKeys } from 'modules/waiter/application';
import { waiterRepository } from 'modules/waiter/data-access';
import type { WaiterMenuCategory, WaiterMenuItem, WaiterOrderItem } from 'modules/waiter/domain';
import { resolveApiBaseUrl } from 'shared/api/apiUrl';
import { formatPosCopy, getPosCopy } from 'shared/locale/copy';
import { useOptimisticBuilderOrder } from 'shared/pos/useOptimisticBuilderOrder';
import { PosBuilderPageSkeleton } from 'shared/ui/pos-primitives';

type CatalogMenuItemLike = {
  id: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  prepStationName?: string | null;
  price: number | string;
};

type CatalogCategoryLike<TMenuItem extends CatalogMenuItemLike> = {
  id: string;
  name: string;
  imageUrl?: string | null;
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

function resolveBuilderChannel(value: string | null): CashierBuilderOrderChannel {
  return value === 'delivery' || value === 'takeaway' ? value : 'hall';
}

function getDefaultCategory<TMenuItem extends CatalogMenuItemLike>(categories: CatalogCategoryLike<TMenuItem>[]) {
  return categories
    .slice()
    .sort((leftCategory, rightCategory) => rightCategory.items.length - leftCategory.items.length)[0];
}

function resolveImageUrl(imageUrl?: string | null) {
  if (!imageUrl) {
    return null;
  }

  try {
    return new URL(imageUrl, resolveApiBaseUrl()).toString();
  } catch {
    return imageUrl;
  }
}

function resolveMenuItemImageUrl(menuItem: CatalogMenuItemLike) {
  return resolveImageUrl(menuItem.imageUrl);
}

function resolveCategoryImageUrl<TMenuItem extends CatalogMenuItemLike>(category: CatalogCategoryLike<TMenuItem>) {
  const categoryImageUrl = resolveImageUrl(category.imageUrl);

  if (categoryImageUrl) {
    return categoryImageUrl;
  }

  for (const menuItem of category.items) {
    const menuItemImageUrl = resolveMenuItemImageUrl(menuItem);
    if (menuItemImageUrl) {
      return menuItemImageUrl;
    }
  }

  return null;
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
  const [isSelectionDialogOpen, setSelectionDialogOpen] = useState(false);

  const defaultCategory = useMemo(() => getDefaultCategory(categories), [categories]);
  const selectedCategory = categories.find((category) => category.id === selectedCategoryId) ?? defaultCategory;
  const selectedCategoryItems = selectedCategory?.items ?? [];
  const { countMap, latestItemMap } = useMemo(() => buildOrderItemMeta(orderItems), [orderItems]);
  const menuItemById = useMemo(
    () => new Map(categories.flatMap((category) => category.items.map((menuItem) => [menuItem.id, menuItem] as const))),
    [categories],
  );
  const selectedItems = useMemo(() => aggregateSummaryItems(orderItems, copy.menu), [copy.menu, orderItems]);
  const selectedCount = selectedItems.reduce((sum, item) => sum + item.quantity, 0);

  if (isLoading) {
    return <PosBuilderPageSkeleton mobile={isMobile} />;
  }

  const handleReturnToMenu = () => {
    if (!hasPendingOperations) {
      navigate(returnPath);
    }
  };

  const renderCategoryArtwork = (category: CatalogCategoryLike<TMenuItem>) => {
    const imageUrl = resolveCategoryImageUrl(category);

    if (imageUrl) {
      return (
        <Box
          component="img"
          src={imageUrl}
          alt={category.name}
          loading="lazy"
          sx={{ width: '100%', height: '100%', display: 'block', objectFit: 'cover' }}
        />
      );
    }

    return (
      <Box
        sx={{
          width: '100%',
          height: '100%',
          display: 'grid',
          placeItems: 'center',
          color: '#d4df36',
          background: 'radial-gradient(circle at 48% 34%, rgba(212,223,54,0.22), rgba(18,20,22,0.94) 62%)',
        }}>
        <Icon icon="solar:chef-hat-bold-duotone" width={34} />
      </Box>
    );
  };

  const renderMenuItemArtwork = (menuItem: TMenuItem) => {
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
            height: '100%',
            display: 'block',
            objectFit: 'cover',
            filter: 'saturate(1.04) contrast(1.04)',
          }}
        />
      );
    }

    return (
      <Box
        sx={{
          width: '100%',
          height: '100%',
          display: 'grid',
          placeItems: 'center',
          color: 'rgba(255,255,255,0.64)',
          background: 'radial-gradient(circle at 50% 38%, #303942 0%, #171b20 52%, #070808 100%)',
        }}>
        <Icon icon="solar:dish-bold-duotone" width={58} />
      </Box>
    );
  };

  const renderCatalogControls = (menuItem: TMenuItem, selectedCountForItem: number) => {
    const latestItemId = latestItemMap.get(menuItem.id);

    return (
      <Stack
        direction="row"
        spacing={0.8}
        alignItems="center"
        onClick={(event) => event.stopPropagation()}
        sx={{ flexShrink: 0 }}>
        <IconButton
          aria-label={`Remove ${menuItem.name}`}
          disabled={hasPendingOperations || selectedCountForItem <= 0 || !latestItemId}
          onClick={() => {
            if (latestItemId) {
              removeItem(latestItemId);
            }
          }}
          sx={{
            width: 38,
            height: 38,
            color: '#f5f5f5',
            borderRadius: '999px',
            backgroundColor: 'rgba(255,255,255,0.08)',
            '&:hover': { backgroundColor: 'rgba(255,255,255,0.14)' },
            '&.Mui-disabled': { color: 'rgba(255,255,255,0.22)', backgroundColor: 'rgba(255,255,255,0.04)' },
          }}>
          <Icon icon="solar:minus-circle-bold" width={23} />
        </IconButton>
        <Box
          sx={{
            minWidth: 28,
            height: 38,
            display: 'grid',
            placeItems: 'center',
            color: '#f5f5f5',
            fontSize: 18,
            fontWeight: 900,
          }}>
          {selectedCountForItem}
        </Box>
        <IconButton
          aria-label={`Add one ${menuItem.name}`}
          disabled={hasPendingOperations}
          onClick={() => addItem(menuItem, '')}
          sx={{
            width: 38,
            height: 38,
            color: '#f5f5f5',
            borderRadius: '999px',
            backgroundColor: 'rgba(212,223,54,0.18)',
            '&:hover': { backgroundColor: 'rgba(212,223,54,0.28)' },
            '&.Mui-disabled': { color: 'rgba(255,255,255,0.22)', backgroundColor: 'rgba(255,255,255,0.04)' },
          }}>
          <Icon icon="solar:add-circle-bold" width={24} />
        </IconButton>
      </Stack>
    );
  };

  const renderCategoryButton = (category: CatalogCategoryLike<TMenuItem>) => {
    const isActive = category.id === selectedCategory?.id;
    const categorySelectedCount = category.items.reduce(
      (totalCount, menuItem) => totalCount + (countMap.get(menuItem.id) ?? 0),
      0,
    );

    return (
      <Box
        key={category.id}
        component="button"
        type="button"
        onClick={() => setSelectedCategoryId(category.id)}
        sx={{
          width: { xs: 132, sm: 148, md: 164, lg: '100%' },
          minWidth: { xs: 132, sm: 148, md: 164, lg: 0 },
          flex: { xs: '0 0 132px', sm: '0 0 148px', md: '0 0 164px', lg: '0 1 auto' },
          minHeight: { xs: 94, sm: 102, lg: 86 },
          px: { xs: 0.85, lg: 1.45 },
          py: { xs: 0.8, lg: 1.1 },
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '74px minmax(0, 1fr)' },
          gap: { xs: 0.75, lg: 1.25 },
          alignItems: 'center',
          border: 0,
          borderBottom: { xs: 0, lg: '1px solid rgba(255,255,255,0.08)' },
          borderRadius: { xs: '14px', lg: 0 },
          cursor: 'pointer',
          textAlign: { xs: 'center', lg: 'left' },
          color: isActive ? '#d4df36' : 'rgba(255,255,255,0.72)',
          backgroundColor: isActive ? 'rgba(212,223,54,0.08)' : 'transparent',
          transition: 'background-color 0.16s ease, color 0.16s ease',
          '&:hover': {
            color: isActive ? '#d4df36' : '#ffffff',
            backgroundColor: isActive ? 'rgba(212,223,54,0.1)' : 'rgba(255,255,255,0.045)',
          },
          '&:focus-visible': {
            outline: '2px solid #d4df36',
            outlineOffset: -2,
          },
        }}>
        <Box
          sx={{
            position: 'relative',
            width: { xs: 64, sm: 70, lg: 74 },
            height: { xs: 56, sm: 62, lg: 64 },
            mx: { xs: 'auto', lg: 0 },
            overflow: 'hidden',
            borderRadius: '12px',
            backgroundColor: '#15181b',
            boxShadow: isActive ? '0 0 24px rgba(212,223,54,0.22)' : '0 12px 22px rgba(0,0,0,0.28)',
          }}>
          {renderCategoryArtwork(category)}
          {categorySelectedCount > 0 ? (
            <Box
              sx={{
                position: 'absolute',
                right: 5,
                top: 5,
                minWidth: 22,
                height: 22,
                px: 0.6,
                display: 'grid',
                placeItems: 'center',
                borderRadius: '999px',
                color: '#080909',
                backgroundColor: '#d4df36',
                fontSize: 12,
                fontWeight: 900,
              }}>
              {categorySelectedCount}
            </Box>
          ) : null}
        </Box>
        <Typography
          component="span"
          sx={{
            minWidth: 0,
            fontSize: { xs: 12, sm: 13, lg: 15 },
            fontWeight: isActive ? 900 : 800,
            lineHeight: 1.18,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: { xs: 2, lg: 2 },
          }}>
          {category.name}
        </Typography>
      </Box>
    );
  };

  const renderCatalogCard = (menuItem: TMenuItem) => {
    const selectedCountForItem = countMap.get(menuItem.id) ?? 0;

    return (
      <Box
        key={menuItem.id}
        role="button"
        tabIndex={0}
        aria-label={`Add ${menuItem.name}`}
        onClick={() => addItem(menuItem, '')}
        onKeyDown={createActionKeyHandler(() => addItem(menuItem, ''))}
        sx={{
          height: { xs: 200, lg: 400 },
          minHeight: { xs: 200, lg: 400 },
          display: 'grid',
          gridTemplateColumns: { xs: '172px minmax(0, 1fr)', sm: '200px minmax(0, 1fr)', lg: '1fr' },
          gridTemplateRows: { xs: 'minmax(0, 1fr)', lg: 'minmax(190px, 1fr) auto 58px' },
          borderRight: '1px solid rgba(255,255,255,0.12)',
          borderBottom: '1px solid rgba(255,255,255,0.12)',
          cursor: 'pointer',
          backgroundColor: '#050505',
          transition: 'background-color 0.16s ease, transform 0.16s ease',
          '&:hover': { backgroundColor: '#0a0b0c' },
          '&:active': { transform: 'scale(0.995)' },
          '&:focus-visible': {
            outline: '2px solid #d4df36',
            outlineOffset: -2,
          },
        }}>
        <Box
          sx={{
            p: { xs: 1.1, sm: 1.35, lg: 2.35 },
            pb: { xs: 1.1, lg: 1.35 },
            minHeight: 0,
            gridRow: { xs: '1 / span 2', lg: 'auto' },
          }}>
          <Box
            sx={{
              position: 'relative',
              height: '100%',
              minHeight: 0,
              overflow: 'hidden',
              backgroundColor: '#12161a',
              backgroundImage: 'radial-gradient(circle at 50% 42%, rgba(82,93,103,0.36), rgba(11,13,15,0.96) 68%)',
            }}>
            {renderMenuItemArtwork(menuItem)}
            {selectedCountForItem > 0 ? (
              <Box
                sx={{
                  position: 'absolute',
                  left: 12,
                  top: 12,
                  minWidth: 34,
                  height: 34,
                  px: 1,
                  display: 'grid',
                  placeItems: 'center',
                  color: '#080909',
                  backgroundColor: '#d4df36',
                  borderRadius: '999px',
                  fontWeight: 900,
                  boxShadow: '0 10px 22px rgba(0,0,0,0.32)',
                }}>
                {selectedCountForItem}
              </Box>
            ) : null}
          </Box>
        </Box>
        <Stack
          spacing={{ xs: 0.65, lg: 1 }}
          sx={{
            minWidth: 0,
            alignSelf: 'end',
            px: { xs: 1.2, sm: 1.5, lg: 2.35 },
            pt: { xs: 1.3, lg: 0 },
          }}>
          <Typography
            variant="h6"
            sx={{
              color: '#f4f4f1',
              fontSize: { xs: 18, sm: 20, lg: 23 },
              fontWeight: 900,
              lineHeight: 1.12,
              letterSpacing: 0,
            }}>
            {menuItem.name}
          </Typography>
          {menuItem.description ? (
            <Typography
              variant="body2"
              sx={{
                color: 'rgba(255,255,255,0.48)',
                fontSize: { xs: 13, lg: 15 },
                lineHeight: 1.32,
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitBoxOrient: 'vertical',
                WebkitLineClamp: { xs: 2, lg: 3 },
              }}>
              {menuItem.description}
            </Typography>
          ) : null}
        </Stack>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="flex-end"
          spacing={1.2}
          sx={{
            alignSelf: 'end',
            px: { xs: 1.2, sm: 1.5, lg: 2.35 },
            pb: { xs: 1.2, lg: 1.8 },
            minWidth: 0,
          }}>
          {renderCatalogControls(menuItem, selectedCountForItem)}
        </Stack>
      </Box>
    );
  };

  const selectionDialog = (
    <Dialog
      open={isSelectionDialogOpen}
      onClose={() => setSelectionDialogOpen(false)}
      fullWidth
      maxWidth="sm"
      PaperProps={{
        sx: {
          color: '#f6f6f4',
          backgroundColor: '#101214',
          backgroundImage: 'none',
          borderRadius: '18px',
          boxShadow: '0 28px 80px rgba(0,0,0,0.58)',
        },
      }}>
      <DialogTitle sx={{ pr: 1.2 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
          <Stack spacing={0.25}>
            <Typography variant="h6" sx={{ fontWeight: 900 }}>
              {copy.selection}
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.54)' }}>
              {formatPosCopy(copy.selectedCount, { count: selectedCount })}
            </Typography>
          </Stack>
          <IconButton
            aria-label={copy.closeSelection}
            onClick={() => setSelectionDialogOpen(false)}
            sx={{ color: 'rgba(255,255,255,0.72)' }}>
            <Icon icon="solar:close-circle-bold-duotone" width={28} />
          </IconButton>
        </Stack>
      </DialogTitle>
      <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
      <DialogContent sx={{ p: 1.5 }}>
        {selectedItems.length > 0 ? (
          <Stack spacing={1}>
            {selectedItems.map((item) => {
              const menuItem = menuItemById.get(item.catalogItem);

              return (
                <Stack
                  key={item.key}
                  direction="row"
                  spacing={1.2}
                  alignItems="center"
                  sx={{
                    minHeight: 64,
                    px: 1.35,
                    py: 1,
                    borderRadius: '12px',
                    backgroundColor: 'rgba(255,255,255,0.055)',
                    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.07)',
                  }}>
                  <Stack sx={{ minWidth: 0, flex: 1 }} spacing={0.2}>
                    <Typography variant="subtitle1" noWrap sx={{ color: '#f6f6f4', fontWeight: 900 }}>
                      {item.catalogItemName}
                    </Typography>
                    {item.note ? (
                      <Typography variant="body2" noWrap sx={{ color: 'rgba(255,255,255,0.48)' }}>
                        {item.note}
                      </Typography>
                    ) : null}
                  </Stack>
                  <Typography variant="h6" sx={{ minWidth: 42, color: '#d4df36', textAlign: 'right', fontWeight: 900 }}>
                    {formatPosCopy(copy.quantityOnlyLabel, { quantity: item.quantity })}
                  </Typography>
                  {menuItem ? renderCatalogControls(menuItem, countMap.get(item.catalogItem) ?? 0) : null}
                </Stack>
              );
            })}
          </Stack>
        ) : (
          <Stack alignItems="center" justifyContent="center" spacing={1.2} sx={{ py: 7, textAlign: 'center' }}>
            <Icon icon="solar:bill-list-bold-duotone" width={52} color="rgba(255,255,255,0.32)" />
            <Typography variant="h6" sx={{ color: '#f6f6f4', fontWeight: 900 }}>
              {copy.noSelectedItems}
            </Typography>
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );

  return (
    <Box
      sx={{
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', lg: '286px minmax(0, 1fr)' },
        gridTemplateRows: { xs: 'auto minmax(0, 1fr)', lg: 'minmax(0, 1fr)' },
        color: '#f6f6f4',
        backgroundColor: '#050505',
      }}>
      <Box
        component="aside"
        sx={{
          minHeight: 0,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#181b1b',
          borderRight: { xs: 0, lg: '1px solid rgba(255,255,255,0.12)' },
          borderBottom: { xs: '1px solid rgba(255,255,255,0.12)', lg: 0 },
        }}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="flex-end"
          spacing={1}
          sx={{ px: { xs: 1.2, sm: 1.55, lg: 1.4 }, py: { xs: 0.9, lg: 1.2 } }}>
          <Stack direction="row" spacing={0.8} alignItems="center">
            <IconButton
              aria-label={`Tanlov oynasi ${selectedCount}`}
              onClick={() => setSelectionDialogOpen(true)}
              sx={{
                position: 'relative',
                width: 40,
                height: 40,
                color: '#f4f4f1',
                backgroundColor: 'rgba(255,255,255,0.07)',
                '&:hover': { backgroundColor: 'rgba(255,255,255,0.12)' },
              }}>
              <Icon icon="solar:bill-list-bold-duotone" width={23} />
              <Box
                component="span"
                sx={{
                  position: 'absolute',
                  top: -4,
                  right: -4,
                  minWidth: 22,
                  height: 22,
                  px: 0.6,
                  display: 'grid',
                  placeItems: 'center',
                  borderRadius: '999px',
                  color: '#080909',
                  backgroundColor: '#d4df36',
                  fontSize: 12,
                  fontWeight: 900,
                }}>
                {selectedCount}
              </Box>
            </IconButton>
            <IconButton
              aria-label="Menyuga qaytish"
              disabled={hasPendingOperations}
              onClick={handleReturnToMenu}
              sx={{
                width: 40,
                height: 40,
                color: 'rgba(255,255,255,0.72)',
                backgroundColor: 'rgba(255,255,255,0.055)',
                '&:hover': { color: '#ffffff', backgroundColor: 'rgba(255,255,255,0.1)' },
                '&.Mui-disabled': { color: 'rgba(255,255,255,0.24)' },
              }}>
              <Icon
                icon={hasPendingOperations ? 'solar:refresh-circle-bold-duotone' : 'solar:close-circle-bold-duotone'}
                width={30}
              />
            </IconButton>
          </Stack>
        </Stack>

        <Box
          sx={{
            minHeight: 0,
            minWidth: 0,
            width: '100%',
            maxWidth: '100%',
            flex: { xs: '0 0 auto', lg: '1 1 0' },
            overflowX: { xs: 'auto', lg: 'hidden' },
            overflowY: { xs: 'hidden', lg: 'auto' },
            display: { xs: 'flex', lg: 'block' },
            flexWrap: 'nowrap',
            gap: { xs: 1, lg: 0 },
            px: { xs: 1.2, sm: 1.55, lg: 0 },
            pb: { xs: 1.1, lg: 0 },
            scrollbarWidth: 'thin',
            WebkitOverflowScrolling: 'touch',
          }}>
          {categories.map((category) => renderCategoryButton(category))}
        </Box>
      </Box>

      <Box
        component="section"
        sx={{ minHeight: 0, overflowY: 'auto', overflowX: 'hidden', backgroundColor: '#050505' }}>
        {selectedCategoryItems.length > 0 ? (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: '1fr',
                md: '1fr',
                lg: 'repeat(4, minmax(0, 1fr))',
                xl: 'repeat(4, minmax(0, 1fr))',
              },
              alignItems: 'stretch',
              borderTop: '1px solid rgba(255,255,255,0.12)',
              borderLeft: { xs: '1px solid rgba(255,255,255,0.12)', lg: 0 },
            }}>
            {selectedCategoryItems.map((menuItem) => renderCatalogCard(menuItem))}
          </Box>
        ) : (
          <Stack
            alignItems="center"
            justifyContent="center"
            spacing={1.2}
            sx={{ minHeight: '100%', textAlign: 'center' }}>
            <Icon icon="solar:dish-bold-duotone" width={58} color="rgba(255,255,255,0.32)" />
            <Typography variant="h6" sx={{ color: '#f6f6f4', fontWeight: 900 }}>
              {copy.noProducts}
            </Typography>
          </Stack>
        )}
      </Box>

      {selectionDialog}
    </Box>
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
    () => getCurrentCashierBuilderOrder(ordersQuery.data, session?.user.id),
    [ordersQuery.data, session?.user.id],
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
    selectCurrentOrder: (orders) => getCurrentCashierBuilderOrder(orders, session?.user.id),
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
