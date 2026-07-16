import { Icon } from '@iconify/react';
import { Box, IconButton, Stack, Typography } from '@mui/material';

import {
  resolveCategoryImageUrl,
  type CatalogCategoryLike,
  type CatalogMenuItemLike,
} from './priceHiddenCatalog.domain';

function CategoryArtwork<TMenuItem extends CatalogMenuItemLike>({
  category,
}: {
  category: CatalogCategoryLike<TMenuItem>;
}) {
  const imageUrl = resolveCategoryImageUrl(category);
  return imageUrl ? (
    <Box
      component="img"
      src={imageUrl}
      alt={category.name}
      loading="lazy"
      sx={{ width: '100%', height: '100%', display: 'block', objectFit: 'cover' }}
    />
  ) : (
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
}

type PriceHiddenCategorySidebarProps<TMenuItem extends CatalogMenuItemLike> = {
  categories: CatalogCategoryLike<TMenuItem>[];
  countMap: Map<string, number>;
  hasPendingOperations: boolean;
  selectedCategoryId?: string;
  selectedCount: number;
  onCategorySelect: (categoryId: string) => void;
  onReturn: () => void;
  onSelectionOpen: () => void;
};

export function PriceHiddenCategorySidebar<TMenuItem extends CatalogMenuItemLike>({
  categories,
  countMap,
  hasPendingOperations,
  selectedCategoryId,
  selectedCount,
  onCategorySelect,
  onReturn,
  onSelectionOpen,
}: PriceHiddenCategorySidebarProps<TMenuItem>) {
  return (
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
            onClick={onSelectionOpen}
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
            onClick={onReturn}
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
        {categories.map((category) => {
          const isActive = category.id === selectedCategoryId;
          const categorySelectedCount = category.items.reduce(
            (total, menuItem) => total + (countMap.get(menuItem.id) ?? 0),
            0,
          );
          return (
            <Box
              key={category.id}
              component="button"
              type="button"
              onClick={() => onCategorySelect(category.id)}
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
                '&:focus-visible': { outline: '2px solid #d4df36', outlineOffset: -2 },
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
                <CategoryArtwork category={category} />
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
        })}
      </Box>
    </Box>
  );
}
