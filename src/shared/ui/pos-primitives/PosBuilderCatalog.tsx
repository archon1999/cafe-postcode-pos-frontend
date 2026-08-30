import { Box, Button, Stack, Typography, alpha } from '@mui/material';
import type { MouseEvent } from 'react';

import { formatPosCopy, getPosCopy, type PosLocale } from 'shared/locale/copy';
import type { PosModifierGroup } from 'shared/pos/modifiers';
import {
  addPosQuantities,
  formatCompactMoney,
  formatMoneyParts,
  formatPosQuantity,
  type PosSaleUnit,
} from 'shared/pos/utils';

import { PosIconAction } from './PosIconAction';
import { PosMenuItemCard, type PosMenuItemCardItem } from './PosMenuItemCard';
import { PosSectionTabs } from './PosSectionTabs';

export type PosBuilderCategoryTab = {
  value: string;
  label: string;
  count: number;
};

export type PosBuilderMenuItem = PosMenuItemCardItem & {
  id: string;
  name: string;
  price: number | string;
  itemType?: 'product' | 'service';
  saleUnit?: PosSaleUnit;
  modifierGroups?: PosModifierGroup[];
};

export type PosBuilderMenuItemGroup<TItem extends PosBuilderMenuItem = PosBuilderMenuItem> = {
  id: string;
  name: string;
  description?: string | null;
  members: Array<{
    id: string;
    item: TItem;
  }>;
};

export type PosBuilderMenuCategory<
  TItem extends PosBuilderMenuItem = PosBuilderMenuItem,
  TGroup extends PosBuilderMenuItemGroup<TItem> = PosBuilderMenuItemGroup<TItem>,
> = {
  id: string;
  name: string;
  items: TItem[];
  itemGroups?: TGroup[];
};

type PosBuilderHeaderProps = {
  categoryId: string;
  categoryTabs: PosBuilderCategoryTab[];
  isMobile: boolean;
  showMenuAction?: boolean;
  onCategoryChange: (categoryId: string) => void;
  onMenuOpen: () => void;
  onRefresh: () => void;
  onSettingsOpen: (event: MouseEvent<HTMLElement>) => void;
  onLock: () => void;
};

export function PosBuilderHeader({
  categoryId,
  categoryTabs,
  isMobile,
  showMenuAction = true,
  onCategoryChange,
  onMenuOpen,
  onRefresh,
  onSettingsOpen,
  onLock,
}: PosBuilderHeaderProps) {
  return (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      spacing={{ xs: 1.1, md: 1.5 }}
      justifyContent="space-between"
      alignItems={{ xs: 'stretch', md: 'flex-start' }}>
      <Stack sx={{ flex: 1, minWidth: 0 }}>
        <PosSectionTabs value={categoryId} items={categoryTabs} onChange={onCategoryChange} scrollable />
      </Stack>

      <Stack direction="row" spacing={{ xs: 1, md: 1.5 }} sx={{ justifyContent: { xs: 'flex-end', md: 'flex-start' } }}>
        {showMenuAction ? <PosIconAction icon="solar:chef-hat-bold-duotone" onClick={onMenuOpen} /> : null}
        {!isMobile ? <PosIconAction icon="solar:refresh-bold-duotone" onClick={onRefresh} /> : null}
        <PosIconAction icon="solar:settings-bold-duotone" onClick={onSettingsOpen} />
        {!isMobile ? <PosIconAction icon="solar:lock-password-bold-duotone" onClick={onLock} /> : null}
      </Stack>
    </Stack>
  );
}

type PosBuilderMenuPanelProps<TItem extends PosBuilderMenuItem, TGroup extends PosBuilderMenuItemGroup<TItem>> = {
  category?: PosBuilderMenuCategory<TItem, TGroup>;
  itemCount: number;
  isMobile: boolean;
  locale: PosLocale;
  menuLabel: string;
  itemCounts: ReadonlyMap<string, number>;
  latestItemIds: ReadonlyMap<string, string>;
  total?: number | string | null;
  billsLabel: string;
  onAdd: (menuItem: TItem) => void;
  onAddWithNote: (menuItem: TItem) => void;
  onOpenGroup: (group: TGroup) => void;
  onCartOpen: () => void;
  onRemove: (itemId: string) => void;
};

export function PosBuilderMenuPanel<TItem extends PosBuilderMenuItem, TGroup extends PosBuilderMenuItemGroup<TItem>>({
  category,
  itemCount,
  isMobile,
  locale,
  menuLabel,
  itemCounts,
  latestItemIds,
  total,
  billsLabel,
  onAdd,
  onAddWithNote,
  onOpenGroup,
  onCartOpen,
  onRemove,
}: PosBuilderMenuPanelProps<TItem, TGroup>) {
  const itemGroups = category?.itemGroups ?? [];
  const groupedItemIds = new Set(itemGroups.flatMap((group) => group.members.map((member) => member.item.id)));

  return (
    <Stack
      spacing={{ xs: 1.5, md: 1.6, xl: 2 }}
      sx={{
        minHeight: 0,
        overflowY: 'auto',
        overflowX: 'hidden',
        px: 0.45,
        pt: 0.35,
        pb: 2,
        mx: -0.45,
      }}>
      <Typography variant="h4">{category?.name ?? menuLabel}</Typography>

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
        {itemGroups.map((group) => (
          <PosMenuItemGroupCard
            key={`group-${group.id}`}
            group={group}
            locale={locale}
            menuLabel={menuLabel}
            selectedCount={getGroupSelectedCount(group, itemCounts)}
            onOpen={() => onOpenGroup(group)}
          />
        ))}
        {(category?.items ?? [])
          .filter((menuItem) => !groupedItemIds.has(menuItem.id))
          .map((menuItem) => (
            <PosMenuItemCard
              key={menuItem.id}
              item={menuItem}
              locale={locale}
              menuLabel={menuLabel}
              selectedCount={itemCounts.get(menuItem.id) ?? 0}
              onAdd={() => onAdd(menuItem)}
              onAddWithNote={
                !menuItem.modifierGroups?.length && menuItem.itemType !== 'service' && menuItem.saleUnit !== 'kg'
                  ? () => onAddWithNote(menuItem)
                  : undefined
              }
              onRemove={() => {
                const latestItemId = latestItemIds.get(menuItem.id);
                if (latestItemId) onRemove(latestItemId);
              }}
            />
          ))}
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
                {itemCount} {menuLabel}
              </Typography>
              <Typography variant="h6" noWrap>
                {formatCompactMoney(total, locale)}
              </Typography>
            </Stack>
            <Button variant="contained" sx={{ minWidth: 132 }} onClick={onCartOpen}>
              {billsLabel}
            </Button>
          </Stack>
        </Box>
      ) : null}
    </Stack>
  );
}

function getGroupSelectedCount<TItem extends PosBuilderMenuItem>(
  group: PosBuilderMenuItemGroup<TItem>,
  itemCounts: ReadonlyMap<string, number>,
) {
  const saleUnits = new Set(group.members.map((member) => member.item.saleUnit ?? 'piece'));

  if (saleUnits.size > 1) {
    return group.members.filter((member) => (itemCounts.get(member.item.id) ?? 0) > 0).length;
  }

  return group.members.reduce((total, member) => addPosQuantities(total, itemCounts.get(member.item.id)), 0);
}

type PosMenuItemGroupCardProps<TItem extends PosBuilderMenuItem> = {
  group: PosBuilderMenuItemGroup<TItem>;
  locale: PosLocale;
  menuLabel: string;
  selectedCount: number;
  onOpen: () => void;
};

export function PosMenuItemGroupCard<TItem extends PosBuilderMenuItem>({
  group,
  locale,
  menuLabel,
  selectedCount,
  onOpen,
}: PosMenuItemGroupCardProps<TItem>) {
  const copy = getPosCopy(locale);
  const minimumPrice = Math.min(...group.members.map((member) => Number(member.item.price || 0)));
  const price = formatMoneyParts(Number.isFinite(minimumPrice) ? minimumPrice : 0, locale);
  const groupSaleUnit = group.members.every((member) => member.item.saleUnit === 'kg') ? 'kg' : 'piece';

  return (
    <Box
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen();
        }
      }}
      sx={(theme) => ({
        border: 0,
        p: 0,
        position: 'relative',
        minHeight: { xs: 112, md: 118, xl: 126 },
        overflow: 'visible',
        borderRadius: '10px',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'transform 0.16s ease',
        '&:hover': {
          transform: 'translateY(-2px)',
          '& [data-menu-item-surface]': {
            backgroundColor: 'var(--pos-menu-product-card-hover-bg)',
            boxShadow:
              theme.palette.mode === 'dark'
                ? '0 14px 26px rgba(0,0,0,0.26), inset 0 0 0 1px rgba(255,255,255,0.06)'
                : '0 14px 28px rgba(40,51,65,0.12), inset 0 0 0 1px rgba(40,51,65,0.08)',
          },
        },
        '&:active': { transform: 'translateY(0) scale(0.985)' },
        '&:focus-visible': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 },
      })}>
      <Box
        data-menu-item-surface
        sx={(theme) => ({
          position: 'relative',
          width: '100%',
          height: '100%',
          minHeight: 'inherit',
          display: 'flex',
          overflow: 'hidden',
          borderRadius: '10px',
          backgroundColor: 'var(--pos-menu-product-card-bg)',
          backgroundImage: 'none',
          transition: 'box-shadow 0.16s ease, background-color 0.16s ease',
          boxShadow:
            theme.palette.mode === 'dark'
              ? 'inset 0 0 0 1px rgba(255,255,255,0.04)'
              : 'inset 0 0 0 1px rgba(40,51,65,0.06)',
          ...(selectedCount > 0
            ? {
                WebkitMaskImage: 'radial-gradient(circle 25px at calc(100% - 14px) 11px, transparent 24px, #000 25px)',
                maskImage: 'radial-gradient(circle 25px at calc(100% - 14px) 11px, transparent 24px, #000 25px)',
              }
            : null),
        })}>
        <Stack justifyContent="space-between" sx={{ flex: 1, minHeight: 0 }}>
          <Stack spacing={0.75} sx={{ p: { xs: 1.25, md: 1.45, xl: 1.85 } }}>
            <Typography variant="body2" color="text.secondary">
              {group.members[0]?.item.prepStationName ?? menuLabel}
            </Typography>
            <Typography variant="h6" sx={{ pr: 1 }}>
              {group.name}
            </Typography>
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
              color: theme.palette.mode === 'dark' ? '#f0f2f5' : theme.palette.text.primary,
              backgroundColor: 'var(--pos-menu-product-price-bg)',
              borderRadius: '0 0 10px 10px',
            })}>
            <Typography variant="body2" color="text.secondary" fontWeight={700}>
              {formatPosCopy(copy.itemGroupProductCount, { count: group.members.length })}
            </Typography>
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
              {locale === 'ru' ? <Box component="span">{copy.itemGroupPriceSuffix}</Box> : null}
              <Box component="span" sx={{ fontSize: { xs: 20, md: 24 }, lineHeight: 1, fontWeight: 900 }}>
                {price.amount}
              </Box>
              <Box component="span" sx={{ fontSize: { xs: 13.5, md: 16 }, lineHeight: 1, fontWeight: 700 }}>
                {price.currency}
              </Box>
              {locale !== 'ru' ? <Box component="span">{copy.itemGroupPriceSuffix}</Box> : null}
            </Typography>
          </Box>
        </Stack>
      </Box>
      {selectedCount > 0 ? (
        <Box
          sx={(theme) => ({
            position: 'absolute',
            top: { xs: -6, md: -7 },
            right: { xs: -3, md: -4 },
            zIndex: 2,
            minWidth: { xs: 32, md: 36 },
            height: { xs: 32, md: 36 },
            px: 0.9,
            borderRadius: '999px',
            backgroundColor: theme.palette.mode === 'dark' ? '#3a3d42' : '#252525',
            color: '#ffffff',
            display: 'grid',
            placeItems: 'center',
            fontSize: { xs: 14, md: 15 },
            fontWeight: 800,
            lineHeight: 1,
            boxShadow: '0 6px 14px rgba(0,0,0,0.22)',
          })}>
          {formatPosQuantity(selectedCount, groupSaleUnit, locale)}
        </Box>
      ) : null}
    </Box>
  );
}
