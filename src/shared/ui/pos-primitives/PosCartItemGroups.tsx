import { Icon } from '@iconify/react';
import { Box, Button, Stack, Typography, alpha } from '@mui/material';
import type { KeyboardEvent } from 'react';

import { formatPosCopy, type PosLocale } from 'shared/locale/copy';
import { formatCompactMoney } from 'shared/pos/utils';

export type PosCartItem = {
  key: string;
  id: string;
  catalogItem: string;
  catalogItemName: string;
  note?: string | null;
  quantity: number;
  lineTotal: number;
  status: string;
  itemIds: string[];
  markingRequiredCount?: number;
  markingScannedCount?: number;
  markingMissingCount?: number;
};

export type PosCartMenuItem = {
  id: string;
};

type CartItemGroup = readonly [string, PosCartItem[]];

export type PosCartItemGroupsProps<TMenuItem extends PosCartMenuItem> = {
  groups: CartItemGroup[];
  itemQuantityLabel: string;
  locale: PosLocale;
  markingProgressLabel?: string;
  menuItems: ReadonlyMap<string, TMenuItem>;
  onAdd: (item: TMenuItem) => void;
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
  menuItems,
  onAdd,
  onRemove,
  variant,
}: {
  item: PosCartItem;
  menuItems: ReadonlyMap<string, TMenuItem>;
  onAdd: (item: TMenuItem) => void;
  onRemove: (itemId: string) => void;
  variant: PosCartItemGroupsProps<TMenuItem>['variant'];
}) {
  const removeLatest = () => onRemove(item.itemIds[item.itemIds.length - 1]);
  const addAnother = () => {
    const menuItem = menuItems.get(item.catalogItem);
    if (menuItem) {
      onAdd(menuItem);
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
  itemQuantityLabel,
  locale,
  markingProgressLabel,
  menuItems,
  onAdd,
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
                  {formatPosCopy(itemQuantityLabel, {
                    name: item.catalogItemName,
                    quantity: item.quantity,
                  })}
                </Typography>
                {item.note ? (
                  <Typography variant={mobile ? 'caption' : 'body2'} color="text.secondary">
                    {item.note}
                  </Typography>
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
              <CartItemActions item={item} menuItems={menuItems} onAdd={onAdd} onRemove={onRemove} variant={variant} />
            ) : null}
          </Box>
        );
      })}
    </Stack>
  ));
}
