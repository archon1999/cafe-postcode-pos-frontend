import { Icon } from '@iconify/react';
import { Box, IconButton, Stack, Typography } from '@mui/material';

import { createActionKeyHandler, resolveMenuItemImageUrl, type CatalogMenuItemLike } from './priceHiddenCatalog.domain';

type ItemActionProps<TMenuItem extends CatalogMenuItemLike> = {
  item: TMenuItem;
  selectedCount: number;
  latestItemId?: string;
  disabled: boolean;
  onAdd: (item: TMenuItem, note: string) => void;
  onRemove: (itemId: string) => void;
};

export function PriceHiddenItemControls<TMenuItem extends CatalogMenuItemLike>({
  item,
  selectedCount,
  latestItemId,
  disabled,
  onAdd,
  onRemove,
}: ItemActionProps<TMenuItem>) {
  return (
    <Stack
      direction="row"
      spacing={0.8}
      alignItems="center"
      onClick={(event) => event.stopPropagation()}
      sx={{ flexShrink: 0 }}>
      <IconButton
        aria-label={`Remove ${item.name}`}
        disabled={disabled || selectedCount <= 0 || !latestItemId}
        onClick={() => latestItemId && onRemove(latestItemId)}
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
        {selectedCount}
      </Box>
      <IconButton
        aria-label={`Add one ${item.name}`}
        disabled={disabled}
        onClick={() => onAdd(item, '')}
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
}

function MenuItemArtwork<TMenuItem extends CatalogMenuItemLike>({ item }: { item: TMenuItem }) {
  const imageUrl = resolveMenuItemImageUrl(item);
  return imageUrl ? (
    <Box
      component="img"
      src={imageUrl}
      alt={item.name}
      loading="lazy"
      sx={{
        width: '100%',
        height: '100%',
        display: 'block',
        objectFit: 'cover',
        filter: 'saturate(1.04) contrast(1.04)',
      }}
    />
  ) : (
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
}

type PriceHiddenCatalogGridProps<TMenuItem extends CatalogMenuItemLike> = {
  items: TMenuItem[];
  countMap: Map<string, number>;
  latestItemMap: Map<string, string>;
  hasPendingOperations: boolean;
  noProductsLabel: string;
  onAdd: (item: TMenuItem, note: string) => void;
  onRemove: (itemId: string) => void;
};

export function PriceHiddenCatalogGrid<TMenuItem extends CatalogMenuItemLike>({
  items,
  countMap,
  latestItemMap,
  hasPendingOperations,
  noProductsLabel,
  onAdd,
  onRemove,
}: PriceHiddenCatalogGridProps<TMenuItem>) {
  return (
    <Box component="section" sx={{ minHeight: 0, overflowY: 'auto', overflowX: 'hidden', backgroundColor: '#050505' }}>
      {items.length > 0 ? (
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
          {items.map((item) => {
            const selectedCount = countMap.get(item.id) ?? 0;
            return (
              <Box
                key={item.id}
                role="button"
                tabIndex={0}
                aria-label={`Add ${item.name}`}
                onClick={() => onAdd(item, '')}
                onKeyDown={createActionKeyHandler(() => onAdd(item, ''))}
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
                  '&:focus-visible': { outline: '2px solid #d4df36', outlineOffset: -2 },
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
                      backgroundImage:
                        'radial-gradient(circle at 50% 42%, rgba(82,93,103,0.36), rgba(11,13,15,0.96) 68%)',
                    }}>
                    <MenuItemArtwork item={item} />
                    {selectedCount > 0 ? (
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
                        {selectedCount}
                      </Box>
                    ) : null}
                  </Box>
                </Box>
                <Stack
                  spacing={{ xs: 0.65, lg: 1 }}
                  sx={{ minWidth: 0, alignSelf: 'end', px: { xs: 1.2, sm: 1.5, lg: 2.35 }, pt: { xs: 1.3, lg: 0 } }}>
                  <Typography
                    variant="h6"
                    sx={{
                      color: '#f4f4f1',
                      fontSize: { xs: 18, sm: 20, lg: 23 },
                      fontWeight: 900,
                      lineHeight: 1.12,
                      letterSpacing: 0,
                    }}>
                    {item.name}
                  </Typography>
                  {item.description ? (
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
                      {item.description}
                    </Typography>
                  ) : null}
                </Stack>
                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="flex-end"
                  spacing={1.2}
                  sx={{ alignSelf: 'end', px: { xs: 1.2, sm: 1.5, lg: 2.35 }, pb: { xs: 1.2, lg: 1.8 }, minWidth: 0 }}>
                  <PriceHiddenItemControls
                    item={item}
                    selectedCount={selectedCount}
                    latestItemId={latestItemMap.get(item.id)}
                    disabled={hasPendingOperations}
                    onAdd={onAdd}
                    onRemove={onRemove}
                  />
                </Stack>
              </Box>
            );
          })}
        </Box>
      ) : (
        <Stack
          alignItems="center"
          justifyContent="center"
          spacing={1.2}
          sx={{ minHeight: '100%', textAlign: 'center' }}>
          <Icon icon="solar:dish-bold-duotone" width={58} color="rgba(255,255,255,0.32)" />
          <Typography variant="h6" sx={{ color: '#f6f6f4', fontWeight: 900 }}>
            {noProductsLabel}
          </Typography>
        </Stack>
      )}
    </Box>
  );
}
