import { Box, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';

import { usePosSession } from 'modules/auth';
import { getPosCopy } from 'shared/locale/copy';
import { PosBuilderPageSkeleton } from 'shared/ui/pos-primitives';

import {
  aggregateSummaryItems,
  buildOrderItemMeta,
  getDefaultCategory,
  type CatalogCategoryLike,
  type CatalogMenuItemLike,
  type CatalogOrderItemLike,
} from './priceHiddenCatalog.domain';
import { PriceHiddenCatalogGrid, PriceHiddenItemControls } from './PriceHiddenCatalogGrid';
import { PriceHiddenCategorySidebar } from './PriceHiddenCategorySidebar';
import { PriceHiddenSelectionDialog } from './PriceHiddenSelectionDialog';

export { resolveBuilderChannel } from './priceHiddenCatalog.domain';
export type { CatalogCategoryLike, CatalogMenuItemLike } from './priceHiddenCatalog.domain';

export function PriceHiddenCatalogContent<TMenuItem extends CatalogMenuItemLike>({
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
  const { countMap, latestItemMap } = useMemo(() => buildOrderItemMeta(orderItems), [orderItems]);
  const menuItemById = useMemo(
    () => new Map(categories.flatMap((category) => category.items.map((item) => [item.id, item] as const))),
    [categories],
  );
  const selectedItems = useMemo(() => aggregateSummaryItems(orderItems, copy.menu), [copy.menu, orderItems]);
  const selectedCount = selectedItems.reduce((sum, item) => sum + item.quantity, 0);

  if (isLoading) {
    return <PosBuilderPageSkeleton mobile={isMobile} />;
  }

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
      <PriceHiddenCategorySidebar
        categories={categories}
        countMap={countMap}
        hasPendingOperations={hasPendingOperations}
        selectedCategoryId={selectedCategory?.id}
        selectedCount={selectedCount}
        onCategorySelect={setSelectedCategoryId}
        onReturn={() => {
          if (!hasPendingOperations) {
            void navigate(returnPath);
          }
        }}
        onSelectionOpen={() => setSelectionDialogOpen(true)}
      />
      <PriceHiddenCatalogGrid
        items={selectedCategory?.items ?? []}
        countMap={countMap}
        latestItemMap={latestItemMap}
        hasPendingOperations={hasPendingOperations}
        noProductsLabel={copy.noProducts}
        onAdd={addItem}
        onRemove={removeItem}
      />
      <PriceHiddenSelectionDialog
        copy={copy}
        open={isSelectionDialogOpen}
        selectedCount={selectedCount}
        selectedItems={selectedItems}
        renderControls={(catalogItemId) => {
          const item = menuItemById.get(catalogItemId);
          return item ? (
            <PriceHiddenItemControls
              item={item}
              selectedCount={countMap.get(catalogItemId) ?? 0}
              latestItemId={latestItemMap.get(catalogItemId)}
              disabled={hasPendingOperations}
              onAdd={addItem}
              onRemove={removeItem}
            />
          ) : null;
        }}
        onClose={() => setSelectionDialogOpen(false)}
      />
    </Box>
  );
}
