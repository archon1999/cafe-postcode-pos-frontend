import { Box, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';

import { usePosSession } from 'modules/auth';
import { getPosCopy } from 'shared/locale/copy';
import type { PosModifierSelection } from 'shared/pos/modifiers';
import { PosBuilderPageSkeleton, PosProductConfiguratorDialog, PosWeightedItemDialog } from 'shared/ui/pos-primitives';

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
  addItems,
  removeItem,
}: {
  categories: CatalogCategoryLike<TMenuItem>[];
  orderItems: CatalogOrderItemLike[] | undefined;
  isLoading: boolean;
  hasPendingOperations: boolean;
  returnPath: string;
  addItem: (menuItem: TMenuItem, note: string, selectedModifiers?: PosModifierSelection[]) => void;
  addItems: (
    items: Array<{
      menuItem: TMenuItem;
      quantity: number;
      note: string;
      selectedModifiers?: PosModifierSelection[];
    }>,
  ) => void;
  removeItem: (itemId: string) => void;
}) {
  const navigate = useNavigate();
  const { locale } = usePosSession();
  const copy = getPosCopy(locale);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [isSelectionDialogOpen, setSelectionDialogOpen] = useState(false);
  const [configuringItem, setConfiguringItem] = useState<TMenuItem | null>(null);
  const [weighingItem, setWeighingItem] = useState<{
    item: TMenuItem;
    selections: PosModifierSelection[];
  } | null>(null);

  const defaultCategory = useMemo(() => getDefaultCategory(categories), [categories]);
  const selectedCategory = categories.find((category) => category.id === selectedCategoryId) ?? defaultCategory;
  const { countMap, latestItemMap } = useMemo(() => buildOrderItemMeta(orderItems), [orderItems]);
  const menuItemById = useMemo(
    () => new Map(categories.flatMap((category) => category.items.map((item) => [item.id, item] as const))),
    [categories],
  );
  const selectedItems = useMemo(() => aggregateSummaryItems(orderItems, copy.menu), [copy.menu, orderItems]);
  const selectedCount = selectedItems.length;
  const requestAdd = (item: TMenuItem) => {
    if (item.modifierGroups?.length) {
      setConfiguringItem(item);
      return;
    }
    if (item.saleUnit === 'kg') {
      setWeighingItem({ item, selections: [] });
      return;
    }
    addItem(item, '');
  };

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
        locale={locale}
        noProductsLabel={copy.noProducts}
        onAdd={(item) => requestAdd(item)}
        onRemove={removeItem}
      />
      <PriceHiddenSelectionDialog
        copy={copy}
        locale={locale}
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
              locale={locale}
              onAdd={(selectedItem) => requestAdd(selectedItem)}
              onRemove={removeItem}
            />
          ) : null;
        }}
        onClose={() => setSelectionDialogOpen(false)}
      />
      {configuringItem ? (
        <PosProductConfiguratorDialog
          item={configuringItem}
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
          onConfirm={(item, selections) => {
            if (item.saleUnit === 'kg') {
              setWeighingItem({ item, selections });
            } else {
              addItem(item, '', selections);
            }
            setConfiguringItem(null);
          }}
        />
      ) : null}
      {weighingItem ? (
        <PosWeightedItemDialog
          item={weighingItem.item}
          selections={weighingItem.selections}
          locale={locale}
          showPrice={false}
          onClose={() => setWeighingItem(null)}
          onConfirm={(quantity) => {
            addItems([
              {
                menuItem: weighingItem.item,
                quantity,
                note: '',
                selectedModifiers: weighingItem.selections,
              },
            ]);
            setWeighingItem(null);
          }}
        />
      ) : null}
    </Box>
  );
}
