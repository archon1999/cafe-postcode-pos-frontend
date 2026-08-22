import { Box, Button, Stack, Typography, alpha } from '@mui/material';
import type { MouseEvent } from 'react';

import type { WaiterMenuCategory, WaiterMenuItem } from 'modules/waiter/domain';
import { getPosCopy, type PosLocale } from 'shared/locale/copy';
import { formatCompactMoney } from 'shared/pos/utils';
import { PosIconAction, PosSectionTabs } from 'shared/ui/pos-primitives';

import { WaiterMenuItemCard } from './WaiterMenuItemCard';

type TableSessionHeaderProps = {
  categoryTabs: Array<{ value: string; label: string; count: number }>;
  isMobile: boolean;
  selectedCategoryId: string;
  sessionId: string | null;
  showCatalogAction: boolean;
  onCategoryChange: (categoryId: string) => void;
  onCatalog: () => void;
  onLock: () => void;
  onRefresh: () => void;
  onSettings: (event: MouseEvent<HTMLElement>) => void;
};

export function TableSessionHeader({
  categoryTabs,
  isMobile,
  selectedCategoryId,
  sessionId,
  showCatalogAction,
  onCategoryChange,
  onCatalog,
  onLock,
  onRefresh,
  onSettings,
}: TableSessionHeaderProps) {
  return (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      spacing={{ xs: 1.1, md: 1.5 }}
      justifyContent="space-between"
      alignItems={{ xs: 'stretch', md: 'flex-start' }}>
      <Stack sx={{ flex: 1, minWidth: 0 }}>
        <PosSectionTabs value={selectedCategoryId} items={categoryTabs} onChange={onCategoryChange} scrollable />
      </Stack>
      <Stack direction="row" spacing={{ xs: 1, md: 1.5 }} sx={{ justifyContent: { xs: 'flex-end', md: 'flex-start' } }}>
        {showCatalogAction && sessionId ? (
          <PosIconAction icon="solar:chef-hat-bold-duotone" onClick={onCatalog} />
        ) : null}
        {!isMobile ? <PosIconAction icon="solar:refresh-bold-duotone" onClick={onRefresh} /> : null}
        <PosIconAction icon="solar:settings-bold-duotone" onClick={onSettings} />
        {!isMobile ? <PosIconAction icon="solar:lock-password-bold-duotone" onClick={onLock} /> : null}
      </Stack>
    </Stack>
  );
}

type TableSessionMenuPanelProps = {
  copy: ReturnType<typeof getPosCopy>;
  currentTotal?: number | string | null;
  itemCount: number;
  latestItemMap: ReadonlyMap<string, string>;
  locale: PosLocale;
  selectedCategory?: WaiterMenuCategory;
  selectedCountMap: ReadonlyMap<string, number>;
  showMobileSummary: boolean;
  onAdd: (menuItem: WaiterMenuItem) => void;
  onAddWithNote: (menuItem: WaiterMenuItem) => void;
  onOpenCart: () => void;
  onRemove: (itemId: string) => void;
};

export function TableSessionMenuPanel({
  copy,
  currentTotal,
  itemCount,
  latestItemMap,
  locale,
  selectedCategory,
  selectedCountMap,
  showMobileSummary,
  onAdd,
  onAddWithNote,
  onOpenCart,
  onRemove,
}: TableSessionMenuPanelProps) {
  return (
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
            '@media (min-width: 1800px)': { gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' },
          },
          gridAutoRows: '1fr',
          gap: { xs: 1.1, md: 1.2, xl: 1.4 },
        }}>
        {(selectedCategory?.items ?? []).map((menuItem) => (
          <WaiterMenuItemCard
            key={menuItem.id}
            copy={copy}
            latestItemId={latestItemMap.get(menuItem.id)}
            locale={locale}
            menuItem={menuItem}
            selectedCount={selectedCountMap.get(menuItem.id) ?? 0}
            onAdd={() => onAdd(menuItem)}
            onAddWithNote={
              !menuItem.modifierGroups?.length && menuItem.itemType !== 'service' && menuItem.saleUnit !== 'kg'
                ? () => onAddWithNote(menuItem)
                : undefined
            }
            onRemove={onRemove}
          />
        ))}
      </Box>
      {showMobileSummary ? (
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
                {itemCount} {copy.menu}
              </Typography>
              <Typography variant="h6" noWrap>
                {formatCompactMoney(currentTotal, locale)}
              </Typography>
            </Stack>
            <Button variant="contained" sx={{ minWidth: 132 }} onClick={onOpenCart}>
              {copy.bills}
            </Button>
          </Stack>
        </Box>
      ) : null}
    </Stack>
  );
}
