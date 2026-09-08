import { Icon } from '@iconify/react';
import { Box, Stack, Typography, alpha } from '@mui/material';
import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';

import { resolveApiBaseUrl } from 'shared/api/apiUrl';
import { getSaleUnit, saleUnitLabel } from 'shared/domain/sale-units';
import { getPosCopy, type PosLocale } from 'shared/locale/copy';
import { inventoryAvailabilityLabel, type PosInventoryAvailability } from 'shared/pos/inventory';
import { formatMoneyParts, formatPosQuantity, type PosSaleUnit } from 'shared/pos/utils';

export type PosMenuItemCardItem = {
  inventory?: PosInventoryAvailability;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  itemType?: string | null;
  prepStationName?: string | null;
  price?: number | string | null;
  saleUnit?: PosSaleUnit;
};

type PosMenuItemCardProps = {
  item: PosMenuItemCardItem;
  locale: PosLocale;
  menuLabel: string;
  selectedCount: number;
  onAdd: () => void;
  onAddWithNote?: () => void;
  onRemove: () => void;
};

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

export function PosMenuItemCard({
  item,
  locale,
  menuLabel,
  selectedCount,
  onAdd,
  onAddWithNote,
  onRemove,
}: PosMenuItemCardProps) {
  const imageUrl = resolveImageUrl(item.imageUrl);
  const copy = getPosCopy(locale);
  const blocked = Boolean(item.inventory?.blocked);
  const stockLabel = inventoryAvailabilityLabel(item.inventory, locale);
  const price = formatMoneyParts(Number(item.price ?? 0), locale);
  const [noteActionVisible, setNoteActionVisible] = useState(false);
  const swipeStartRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const suppressClickUntilRef = useRef(0);
  const noteSwipeEnabled = Boolean(onAddWithNote) && !blocked;

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    event.preventDefault();
    if (!blocked) onAdd();
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!noteSwipeEnabled) return;
    if ((event.target as Element).closest('button')) return;
    swipeStartRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setNoteActionVisible(false);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = swipeStartRef.current;
    if (!start || start.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (Math.abs(deltaY) > Math.abs(deltaX)) return;
    setNoteActionVisible(deltaX < -28);
  };

  const finishPointer = (event: PointerEvent<HTMLDivElement>) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    setNoteActionVisible(false);
    if (!start || start.pointerId !== event.pointerId || !onAddWithNote) return;

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (deltaX < -72 && Math.abs(deltaX) > Math.abs(deltaY) * 1.4) {
      suppressClickUntilRef.current = Date.now() + 500;
      onAddWithNote();
    }
  };

  return (
    <Box
      role="button"
      tabIndex={blocked ? -1 : 0}
      aria-disabled={blocked}
      onClick={() => {
        if (blocked || Date.now() < suppressClickUntilRef.current) return;
        onAdd();
      }}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishPointer}
      onPointerCancel={() => {
        swipeStartRef.current = null;
        setNoteActionVisible(false);
      }}
      sx={(theme) => ({
        border: 0,
        p: 0,
        position: 'relative',
        display: 'flex',
        height: '100%',
        minHeight: { xs: 112, md: 118, xl: 126 },
        overflow: 'visible',
        borderRadius: '10px',
        cursor: blocked ? 'not-allowed' : 'pointer',
        opacity: blocked ? 0.65 : 1,
        textAlign: 'left',
        touchAction: noteSwipeEnabled ? 'pan-y' : 'auto',
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
        sx={{
          position: 'relative',
          width: '100%',
          height: '100%',
          minHeight: 'inherit',
          overflow: 'hidden',
          borderRadius: '10px',
        }}>
        {noteSwipeEnabled ? (
          <Box
            aria-hidden="true"
            data-testid="menu-item-note-swipe-action"
            sx={(theme) => ({
              position: 'absolute',
              inset: 0,
              pl: 'calc(100% - 54px)',
              display: 'grid',
              placeItems: 'center',
              borderRadius: '10px',
              color: '#ffffff',
              backgroundColor: theme.palette.primary.main,
              opacity: noteActionVisible ? 1 : 0,
              transition: 'opacity 140ms ease',
            })}>
            <Icon icon="solar:notes-bold-duotone" width={24} />
          </Box>
        ) : null}
        <Box
          data-menu-item-surface
          data-swipe-revealed={noteActionVisible ? 'true' : undefined}
          data-testid="menu-item-card-surface"
          sx={(theme) => ({
            position: 'relative',
            zIndex: 1,
            width: '100%',
            height: '100%',
            minHeight: 'inherit',
            display: 'flex',
            overflow: 'hidden',
            borderRadius: '10px',
            backgroundColor: 'var(--pos-menu-product-card-bg)',
            backgroundImage: 'none',
            transform: noteActionVisible ? 'translateX(-54px)' : 'translateX(0)',
            transition: 'transform 140ms ease, box-shadow 0.16s ease, background-color 0.16s ease',
            boxShadow:
              theme.palette.mode === 'dark'
                ? 'inset 0 0 0 1px rgba(255,255,255,0.04)'
                : 'inset 0 0 0 1px rgba(40,51,65,0.06)',
            ...(selectedCount > 0
              ? {
                  WebkitMaskImage:
                    'radial-gradient(circle 25px at calc(100% - 14px) 11px, transparent 24px, #000 25px)',
                  maskImage: 'radial-gradient(circle 25px at calc(100% - 14px) 11px, transparent 24px, #000 25px)',
                }
              : null),
          })}>
          {imageUrl ? (
            <Box
              component="img"
              src={imageUrl}
              alt={item.name}
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
          <Stack justifyContent="space-between" sx={{ flex: 1, minHeight: 0 }}>
            <Stack
              spacing={0.75}
              sx={{
                p: { xs: 1.25, md: 1.45, xl: 1.85 },
                pr: imageUrl ? { xs: 7.25, md: 8.4, xl: 9.5 } : undefined,
              }}>
              <Typography variant="body2" color="text.secondary">
                {item.prepStationName ?? menuLabel}
              </Typography>
              <Typography variant="h6" sx={{ pr: 1 }}>
                {item.name}
              </Typography>
              {stockLabel ? (
                <Typography variant="caption" color={blocked ? 'error' : 'warning.main'}>
                  {stockLabel}
                </Typography>
              ) : null}
              {item.description ? (
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
                  {item.description}
                </Typography>
              ) : null}
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
                fontSize: { xs: 14, md: 16 },
                fontWeight: 700,
                color: theme.palette.mode === 'dark' ? '#f0f2f5' : theme.palette.text.primary,
                backgroundColor: 'var(--pos-menu-product-price-bg)',
                borderRadius: '0 0 10px 10px',
              })}>
              {selectedCount > 0 ? (
                <Stack data-testid="menu-item-controls" direction="row" spacing={0.8} alignItems="center">
                  <QuantityButton icon="solar:minus-circle-bold" onClick={onRemove} />
                  {!blocked ? <QuantityButton icon="solar:add-circle-bold" onClick={onAdd} /> : null}
                </Stack>
              ) : null}
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
                {item.itemType === 'service' ? (
                  <Box component="span" sx={{ fontSize: { xs: 13, md: 14 }, color: 'text.secondary' }}>
                    {copy.priceOnSelection}
                  </Box>
                ) : (
                  <>
                    <Box component="span" sx={{ fontSize: { xs: 20, md: 24 }, lineHeight: 1, fontWeight: 900 }}>
                      {price.amount}
                    </Box>
                    <Box component="span" sx={{ fontSize: { xs: 13.5, md: 16 }, lineHeight: 1, fontWeight: 700 }}>
                      {price.currency}
                    </Box>
                  </>
                )}
                {item.itemType !== 'service' && getSaleUnit(item.saleUnit).quantityInput ? (
                  <Box component="span" sx={{ fontSize: { xs: 12, md: 14 }, color: 'text.secondary' }}>
                    / {saleUnitLabel(item.saleUnit, locale)}
                  </Box>
                ) : null}
              </Typography>
            </Box>
          </Stack>
        </Box>
      </Box>
      {selectedCount > 0 ? (
        <Box
          data-testid="menu-item-count-badge"
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
          {formatPosQuantity(selectedCount, item.saleUnit, locale)}
        </Box>
      ) : null}
    </Box>
  );
}

function QuantityButton({ icon, onClick }: { icon: string; onClick: () => void }) {
  return (
    <Box
      component="button"
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
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
        '&:hover': { backgroundColor: theme.palette.mode === 'dark' ? '#363a40' : '#ffffff' },
        '&:active': { transform: 'scale(0.92)' },
        '&:focus-visible': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 1 },
      })}>
      <Icon icon={icon} width={18} />
    </Box>
  );
}
