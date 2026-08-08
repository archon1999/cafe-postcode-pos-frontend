import { Box, Stack, Typography } from '@mui/material';

import type { CashierMenuItemGroup } from 'modules/cashier/domain';
import { formatPosCopy, getPosCopy, type PosLocale } from 'shared/locale/copy';
import { formatMoneyParts } from 'shared/pos/utils';

type Props = {
  group: CashierMenuItemGroup;
  locale: PosLocale;
  menuLabel: string;
  selectedCount: number;
  onOpen: () => void;
};

export function CashierMenuItemGroupCard({ group, locale, menuLabel, selectedCount, onOpen }: Props) {
  const copy = getPosCopy(locale);
  const minimumPrice = Math.min(...group.members.map((member) => Number(member.item.price || 0)));
  const price = formatMoneyParts(Number.isFinite(minimumPrice) ? minimumPrice : 0, locale);

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
          {selectedCount}
        </Box>
      ) : null}
    </Box>
  );
}
