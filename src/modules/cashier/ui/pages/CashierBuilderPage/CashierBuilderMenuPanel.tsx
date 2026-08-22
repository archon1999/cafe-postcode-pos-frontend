import { Box, Button, Stack, Typography, alpha } from '@mui/material';

import {
  aggregateCashierCartItemsByStation,
  type CashierMenuCategory,
  type CashierMenuItem,
  type CashierMenuItemGroup,
} from 'modules/cashier/domain';
import type { PosLocale } from 'shared/locale/copy';
import { addPosQuantities, formatCompactMoney } from 'shared/pos/utils';
import { PosMenuItemCard } from 'shared/ui/pos-primitives';

import { CashierMenuItemGroupCard } from './CashierMenuItemGroupCard';

type CashierBuilderMenuPanelProps = {
  category?: CashierMenuCategory;
  groups: ReturnType<typeof aggregateCashierCartItemsByStation>;
  isMobile: boolean;
  locale: PosLocale;
  menuLabel: string;
  itemCounts: Map<string, number>;
  latestItemIds: Map<string, string>;
  total?: number | string | null;
  billsLabel: string;
  onAdd: (menuItem: CashierMenuItem) => void;
  onAddWithNote: (menuItem: CashierMenuItem) => void;
  onOpenGroup: (group: CashierMenuItemGroup) => void;
  onCartOpen: () => void;
  onRemove: (itemId: string) => void;
};

export function CashierBuilderMenuPanel({
  category,
  groups,
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
}: CashierBuilderMenuPanelProps) {
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
        {(category?.itemGroups ?? []).map((group) => (
          <CashierMenuItemGroupCard
            key={`group-${group.id}`}
            group={group}
            locale={locale}
            menuLabel={menuLabel}
            selectedCount={getGroupSelectedCount(group, itemCounts)}
            onOpen={() => onOpenGroup(group)}
          />
        ))}
        {(category?.items ?? [])
          .filter(
            (menuItem) =>
              !(category?.itemGroups ?? []).some((group) =>
                group.members.some((member) => member.item.id === menuItem.id),
              ),
          )
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
                if (latestItemId) {
                  onRemove(latestItemId);
                }
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
                {groups.reduce((sum, [, items]) => sum + items.length, 0)} {menuLabel}
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

function getGroupSelectedCount(group: CashierMenuItemGroup, itemCounts: Map<string, number>) {
  const saleUnits = new Set(group.members.map((member) => member.item.saleUnit ?? 'piece'));

  if (saleUnits.size > 1) {
    return group.members.filter((member) => (itemCounts.get(member.item.id) ?? 0) > 0).length;
  }

  return group.members.reduce((total, member) => addPosQuantities(total, itemCounts.get(member.item.id)), 0);
}
