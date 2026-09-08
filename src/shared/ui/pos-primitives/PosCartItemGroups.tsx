import { Icon } from '@iconify/react';
import { Box, Button, Stack, Typography, alpha } from '@mui/material';
import type { KeyboardEvent } from 'react';

import type { SaleUnit } from 'shared/domain/sale-units';
import { formatPosCopy, type PosLocale } from 'shared/locale/copy';
import type { PosOrderItemModifier } from 'shared/pos/modifiers';
import { isTemporaryBuilderId } from 'shared/pos/optimistic-builder-order';
import { formatCompactMoney, formatPosItemQuantityLabel } from 'shared/pos/utils';

export type PosCartItem = {
  key: string;
  id: string;
  catalogItem: string;
  catalogItemName: string;
  note?: string | null;
  quantity: number;
  saleUnit?: SaleUnit;
  lineTotal: number;
  status: string;
  itemIds: string[];
  markingRequiredCount?: number;
  markingScannedCount?: number;
  markingMissingCount?: number;
  modifiers?: PosOrderItemModifier[];
};

export type PosCartMenuItem = {
  id: string;
};

type CartItemGroup = readonly [string, PosCartItem[]];

export type PosCartItemGroupsProps<TMenuItem extends PosCartMenuItem> = {
  groups: CartItemGroup[];
  itemNoteAddLabel: string;
  itemNoteEditLabel: string;
  itemNotePendingLabel: string;
  locale: PosLocale;
  markingProgressLabel?: string;
  menuItems: ReadonlyMap<string, TMenuItem>;
  onAdd: (item: TMenuItem, sourceItem: PosCartItem) => void;
  onEditNote: (item: PosCartItem) => void;
  onRemove: (itemId: string) => void;
  onSelect: (key: string) => void;
  selectedItemKey: string | null;
  variant: 'desktop' | 'mobile';
};

function activationHandler(onActivate: () => void) {
  return (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    onActivate();
  };
}

function CartItemActions<TMenuItem extends PosCartMenuItem>({
  item,
  itemNoteAddLabel,
  itemNoteEditLabel,
  itemNotePendingLabel,
  menuItems,
  onAdd,
  onEditNote,
  onRemove,
  variant,
}: {
  item: PosCartItem;
  itemNoteAddLabel: string;
  itemNoteEditLabel: string;
  itemNotePendingLabel: string;
  menuItems: ReadonlyMap<string, TMenuItem>;
  onAdd: (item: TMenuItem, sourceItem: PosCartItem) => void;
  onEditNote: (item: PosCartItem) => void;
  onRemove: (itemId: string) => void;
  variant: PosCartItemGroupsProps<TMenuItem>['variant'];
}) {
  const noteEditingDisabled = isTemporaryBuilderId(item.id);
  const noteActionLabel = noteEditingDisabled ? itemNotePendingLabel : item.note ? itemNoteEditLabel : itemNoteAddLabel;
  const removeLatest = () => onRemove(item.itemIds[item.itemIds.length - 1]);
  const addAnother = () => {
    const menuItem = menuItems.get(item.catalogItem);
    if (menuItem) {
      onAdd(menuItem, item);
    }
  };

  if (variant === 'mobile') {
    return (
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
            removeLatest();
          }}
          sx={{ minWidth: 54, px: 0 }}>
          <Icon icon="solar:minus-circle-bold" width={18} />
        </Button>
        <Button
          variant="contained"
          aria-label={noteActionLabel}
          title={noteActionLabel}
          disabled={noteEditingDisabled}
          onClick={(event) => {
            event.stopPropagation();
            onEditNote(item);
          }}
          sx={{ minWidth: 54, px: 0 }}>
          <Icon icon="solar:notes-bold-duotone" width={18} />
        </Button>
        <Button
          variant="contained"
          onClick={(event) => {
            event.stopPropagation();
            addAnother();
          }}
          sx={{ minWidth: 54, px: 0 }}>
          <Icon icon="solar:add-circle-bold" width={18} />
        </Button>
      </Stack>
    );
  }

  const actionSx = (theme: { palette: { mode: string } }) => ({
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
      theme.palette.mode === 'dark' ? 'inset 0 0 0 1px rgba(255,255,255,0.08)' : 'inset 0 0 0 1px rgba(38,42,48,0.08)',
    '&:hover': { backgroundColor: 'var(--pos-cart-action-hover-bg)' },
    '&:active': { transform: 'scale(0.94)' },
  });

  return (
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
          removeLatest();
        }}
        sx={actionSx}>
        <Icon icon="solar:minus-circle-bold" width={22} />
      </Box>
      <Box
        component="button"
        type="button"
        aria-label={noteActionLabel}
        title={noteActionLabel}
        disabled={noteEditingDisabled}
        onClick={(event) => {
          event.stopPropagation();
          onEditNote(item);
        }}
        sx={(theme) => ({
          ...actionSx(theme),
          color: item.note ? theme.palette.primary.main : actionSx(theme).color,
          opacity: noteEditingDisabled ? 0.45 : 1,
          cursor: noteEditingDisabled ? 'wait' : 'pointer',
        })}>
        <Icon icon="solar:notes-bold-duotone" width={22} />
      </Box>
      <Box
        component="button"
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          addAnother();
        }}
        sx={actionSx}>
        <Icon icon="solar:add-circle-bold" width={22} />
      </Box>
    </Stack>
  );
}

export function PosCartItemGroups<TMenuItem extends PosCartMenuItem>({
  groups,
  itemNoteAddLabel,
  itemNoteEditLabel,
  itemNotePendingLabel,
  locale,
  markingProgressLabel,
  menuItems,
  onAdd,
  onEditNote,
  onRemove,
  onSelect,
  selectedItemKey,
  variant,
}: PosCartItemGroupsProps<TMenuItem>) {
  const mobile = variant === 'mobile';

  return groups.map(([stationName, items]) => (
    <Stack key={stationName} spacing={0.85}>
      <Typography variant="body2" color="text.secondary">
        {stationName}
      </Typography>
      {items.map((item) => {
        const selected = selectedItemKey === item.key;
        const actionsVisible = selected && item.status !== 'cancelled' && menuItems.has(item.catalogItem);

        return (
          <Box
            key={item.key}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(item.key)}
            onKeyDown={activationHandler(() => onSelect(item.key))}
            sx={(theme) => ({
              width: '100%',
              border: 0,
              p: 0,
              textAlign: 'left',
              borderRadius: mobile ? '12px' : '10px',
              overflow: 'hidden',
              backgroundColor: 'var(--pos-cart-item-bg)',
              boxShadow: selected ? `inset 0 0 0 1px ${alpha(theme.palette.primary.main, 0.44)}` : 'none',
              ...(!mobile && {
                transition:
                  'background-color 0.16s ease, box-shadow 0.16s ease, transform 0.16s ease, border-color 0.16s ease',
                '&:hover': {
                  backgroundColor: 'var(--pos-cart-item-hover-bg)',
                  transform: 'translateY(-1px)',
                },
                '&:active': { transform: 'translateY(0) scale(0.992)' },
              }),
            })}>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="flex-start"
              sx={{ p: mobile ? 1.5 : 1.55 }}>
              <Stack spacing={mobile ? 0.25 : 0.35} sx={{ pr: 1, minWidth: mobile ? 0 : undefined }}>
                <Typography
                  variant={mobile ? 'subtitle2' : 'subtitle1'}
                  sx={item.status === 'cancelled' ? { textDecoration: 'line-through', opacity: 0.68 } : undefined}>
                  {formatPosItemQuantityLabel(item.catalogItemName, item.quantity, item.saleUnit, locale)}
                </Typography>
                {item.modifiers?.map((modifier) => (
                  <Stack
                    key={`${modifier.groupName}-${modifier.optionName}`}
                    direction="row"
                    spacing={0.65}
                    alignItems="center">
                    <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: 'primary.main', flex: '0 0 auto' }} />
                    <Typography variant={mobile ? 'caption' : 'body2'} color="text.secondary">
                      {modifier.groupName}: {modifier.optionName}
                      {Number(modifier.priceDelta)
                        ? ` (+${formatCompactMoney(Number(modifier.priceDelta), locale)})`
                        : ''}
                    </Typography>
                  </Stack>
                ))}
                {item.note ? (
                  <Stack
                    direction="row"
                    spacing={0.6}
                    alignItems="flex-start"
                    sx={(theme) => ({
                      width: 'fit-content',
                      maxWidth: '100%',
                      px: 0.75,
                      py: 0.45,
                      borderRadius: '8px',
                      bgcolor: alpha(theme.palette.warning.main, theme.palette.mode === 'dark' ? 0.12 : 0.09),
                      color: theme.palette.mode === 'dark' ? 'warning.light' : 'warning.dark',
                    })}>
                    <Icon icon="solar:notes-bold-duotone" width={mobile ? 15 : 17} />
                    <Typography variant={mobile ? 'caption' : 'body2'} sx={{ color: 'inherit', lineHeight: 1.3 }}>
                      {item.note}
                    </Typography>
                  </Stack>
                ) : null}
                {markingProgressLabel &&
                Number(item.markingRequiredCount ?? 0) > 0 &&
                Number(item.markingMissingCount ?? 0) > 0 ? (
                  <Typography variant={mobile ? 'caption' : 'body2'} color="error.main">
                    {formatPosCopy(markingProgressLabel, {
                      scanned: Number(item.markingScannedCount ?? 0),
                      required: Number(item.markingRequiredCount ?? 0),
                    })}
                  </Typography>
                ) : null}
              </Stack>
              <Typography variant={mobile ? 'subtitle2' : 'subtitle1'} sx={{ whiteSpace: 'nowrap' }}>
                {formatCompactMoney(item.lineTotal, locale)}
              </Typography>
            </Stack>
            {actionsVisible ? (
              <CartItemActions
                item={item}
                itemNoteAddLabel={itemNoteAddLabel}
                itemNoteEditLabel={itemNoteEditLabel}
                itemNotePendingLabel={itemNotePendingLabel}
                menuItems={menuItems}
                onAdd={onAdd}
                onEditNote={onEditNote}
                onRemove={onRemove}
                variant={variant}
              />
            ) : null}
          </Box>
        );
      })}
    </Stack>
  ));
}
