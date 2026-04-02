import { Box, Stack, Typography, alpha } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useMemo } from 'react';
import { Link, useLocation } from 'react-router';

import { PosDockGlyph } from './PosDockGlyph';

type DockItem = {
  key: string;
  label: string;
  path: string;
  badge?: number;
};

const routeActiveMap: Array<{ key: string; matcher: (pathname: string) => boolean }> = [
  { key: 'halls', matcher: (pathname) => pathname.startsWith('/waiter/halls') },
  {
    key: 'builder',
    matcher: (pathname) => pathname.startsWith('/cashier/builder'),
  },
  { key: 'builder', matcher: (pathname) => pathname.startsWith('/cashier/builder') },
  { key: 'kitchen', matcher: (pathname) => pathname.startsWith('/kitchen') },
  { key: 'bills', matcher: (pathname) => pathname.startsWith('/cashier') },
];

const dockGlowMap: Record<
  string,
  {
    color: string;
    opacity: number;
    inset: string;
  }
> = {
  halls: {
    color: '#f7fbff',
    opacity: 0.12,
    inset: '16% 16% 42% 16%',
  },
  menu: {
    color: '#35d9e3',
    opacity: 0.42,
    inset: '28% 20% 26% 24%',
  },
  builder: {
    color: '#53b6ff',
    opacity: 0.24,
    inset: '18% 18% 42% 24%',
  },
  kitchen: {
    color: '#f2f4f7',
    opacity: 0.18,
    inset: '12% 22% 34% 16%',
  },
  bills: {
    color: '#eef2f6',
    opacity: 0.1,
    inset: '16% 18% 42% 22%',
  },
};

export function PosBottomDock({ items }: { items: DockItem[] }) {
  const location = useLocation();
  const theme = useTheme();
  const activeKey = useMemo(
    () => routeActiveMap.find((item) => item.matcher(location.pathname))?.key ?? items[0]?.key,
    [items, location.pathname],
  );

  return (
    <Box
      sx={{
        flexShrink: 0,
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        pt: { xs: 1.2, md: 1.6 },
        pb: { xs: 'calc(env(safe-area-inset-bottom, 0px) + 8px)', md: 'calc(env(safe-area-inset-bottom, 0px) + 10px)' },
        overflow: 'visible',
      }}>
      <Box
        sx={{
          width: { xs: '100%', sm: 'min(100%, 500px)', md: 500 },
          maxWidth: '100%',
          p: { xs: 0.1, md: 0.15 },
          background: 'transparent',
          border: 0,
          backdropFilter: 'none',
          boxShadow: 'none',
        }}>
        <Stack
          direction="row"
          spacing={{ xs: 0.9, md: '16px' }}
          sx={{
            justifyContent: 'center',
            px: 0.25,
            pb: 0.2,
            scrollbarWidth: 'none',
            '&::-webkit-scrollbar': {
              display: 'none',
            },
          }}>
          {items.map((item) => {
            const active = item.key === activeKey;
            const dockGlow = dockGlowMap[item.key] ?? dockGlowMap.halls;

            return (
              <Box
                key={item.key}
                component={Link}
                to={item.path}
                aria-current={active ? 'page' : undefined}
                sx={(theme) => ({
                  flex: '1 1 0',
                  width: 0,
                  py: { xs: 1.2, sm: 1.55, md: 2 },
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  overflow: 'visible',
                  textDecoration: 'none',
                  borderRadius: { xs: '12px', md: '10px' },
                  color: active
                    ? theme.palette.text.primary
                    : theme.palette.mode === 'dark'
                      ? '#a8acb3'
                      : theme.palette.text.secondary,
                  border: `1px solid ${alpha('#ffffff', theme.palette.mode === 'dark' ? (active ? 0.24 : 0.12) : active ? 0.62 : 0.34)}`,
                  background:
                    theme.palette.mode === 'dark'
                      ? active
                        ? 'linear-gradient(180deg, rgba(255,255,255,0.13) 0%, rgba(255,255,255,0.025) 18%, rgba(20,22,26,0.1) 100%), linear-gradient(180deg, rgba(126,130,137,0.88) 0%, rgba(87,91,98,0.74) 52%, rgba(57,60,66,0.82) 100%)'
                        : 'linear-gradient(180deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.018) 18%, rgba(16,18,21,0.12) 100%), linear-gradient(180deg, rgba(67,70,76,0.62) 0%, rgba(47,50,56,0.62) 52%, rgba(32,35,40,0.76) 100%)'
                      : active
                        ? 'linear-gradient(180deg, rgba(255,255,255,0.84) 0%, rgba(248,241,233,0.76) 100%)'
                        : 'linear-gradient(180deg, rgba(255,255,255,0.58) 0%, rgba(242,233,220,0.42) 100%)',
                  backdropFilter: 'blur(28px) saturate(150%)',
                  boxShadow:
                    theme.palette.mode === 'dark'
                      ? active
                        ? 'inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -14px 20px rgba(0,0,0,0.12), 0 14px 26px rgba(0,0,0,0.24)'
                        : 'inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -14px 20px rgba(0,0,0,0.1), 0 10px 20px rgba(0,0,0,0.18)'
                      : active
                        ? 'inset 0 1px 0 rgba(255,255,255,0.7), 0 18px 32px rgba(112,79,43,0.18)'
                        : 'inset 0 1px 0 rgba(255,255,255,0.45), 0 14px 26px rgba(112,79,43,0.14)',
                  transform: active ? 'translateY(-1px)' : 'none',
                  transition: 'transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease',
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    inset: 1,
                    borderRadius: 'inherit',
                    background:
                      theme.palette.mode === 'dark'
                        ? `linear-gradient(180deg, ${alpha('#ffffff', active ? 0.2 : 0.1)} 0%, rgba(255,255,255,0.02) 26%, rgba(255,255,255,0) 58%, ${alpha('#ffffff', active ? 0.06 : 0.03)} 100%)`
                        : `linear-gradient(180deg, ${alpha('#ffffff', active ? 0.38 : 0.2)} 0%, rgba(255,255,255,0.04) 52%, ${alpha('#ffffff', active ? 0.12 : 0.08)} 100%)`,
                    pointerEvents: 'none',
                  },
                  '&::after': {
                    content: '""',
                    position: 'absolute',
                    inset: dockGlow.inset,
                    borderRadius: '50%',
                    background: `radial-gradient(circle, ${alpha(dockGlow.color, dockGlow.opacity)} 0%, rgba(255,255,255,0) 74%)`,
                    filter: 'blur(18px)',
                    opacity: active ? 1 : item.key === 'menu' ? 0.82 : 0.46,
                    pointerEvents: 'none',
                  },
                  '&:hover': {
                    transform: 'translateY(-3px)',
                    borderColor: alpha('#ffffff', theme.palette.mode === 'dark' ? 0.28 : 0.62),
                  },
                })}>
                {item.badge ? (
                  <Box
                    sx={{
                      position: 'absolute',
                      top: { xs: -4, md: -9 },
                      right: { xs: -2, md: -7 },
                      minWidth: { xs: 30, md: 40 },
                      height: { xs: 30, md: 40 },
                      px: { xs: 0.7, md: 0.95 },
                      borderRadius: 999,
                      background: 'linear-gradient(180deg, #ff5963 0%, #ff404b 100%)',
                      color: '#ffffff',
                      display: 'grid',
                      placeItems: 'center',
                      fontSize: { xs: 13, md: 18 },
                      fontWeight: 700,
                      lineHeight: 1,
                      boxShadow: '0 12px 20px rgba(255, 64, 75, 0.3)',
                      zIndex: 2,
                    }}>
                    {item.badge > 99 ? '99+' : item.badge}
                  </Box>
                ) : null}
                <Box
                  sx={{
                    width: { xs: 30, sm: 34, md: 60 },
                    height: { xs: 30, sm: 34, md: 60 },
                    mt: { xs: 0.05, md: 0.35 },
                    mb: { xs: 0.25, md: 0.5 },
                    position: 'relative',
                    zIndex: 1,
                    filter: active
                      ? 'drop-shadow(0 6px 12px rgba(255,255,255,0.08))'
                      : 'drop-shadow(0 4px 8px rgba(0,0,0,0.12))',
                  }}>
                  <PosDockGlyph itemKey={item.key} active={active} mode={theme.palette.mode} />
                </Box>
                <Typography
                  variant="caption"
                  sx={(theme) => ({
                    position: 'relative',
                    zIndex: 1,
                    fontSize: { xs: 12, sm: 13.5, md: 17 },
                    fontWeight: 500,
                    textAlign: 'center',
                    color: active
                      ? theme.palette.mode === 'dark'
                        ? '#f4f7fb'
                        : theme.palette.text.primary
                      : theme.palette.mode === 'dark'
                        ? alpha('#f4f7fb', 0.64)
                        : 'inherit',
                    textShadow: active ? '0 2px 10px rgba(0,0,0,0.18)' : 'none',
                  })}>
                  {item.label}
                </Typography>
              </Box>
            );
          })}
        </Stack>
      </Box>
    </Box>
  );
}
