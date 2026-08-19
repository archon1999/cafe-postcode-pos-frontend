import { Icon } from '@iconify/react';
import { Box, Button, IconButton, Stack, alpha } from '@mui/material';
import { useEffect, useRef, type WheelEvent } from 'react';

type PosSectionTabItem = { value: string; label: string; count?: number };

export function PosSectionTabs({
  value,
  items,
  onChange,
  scrollable = false,
}: {
  value: string;
  items: PosSectionTabItem[];
  onChange: (value: string) => void;
  scrollable?: boolean;
}) {
  const railRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const scrollRail = (direction: -1 | 1) => {
    const rail = railRef.current;
    if (!rail) return;
    rail.scrollLeft += direction * Math.max(rail.clientWidth * 0.75, 320);
  };

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    const rail = railRef.current;
    if (!rail || rail.scrollWidth <= rail.clientWidth || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    event.preventDefault();
    rail.scrollLeft += event.deltaY;
  };

  useEffect(() => {
    if (!scrollable) {
      return;
    }

    const activeTab = tabRefs.current[value];
    if (activeTab) {
      activeTab.scrollIntoView?.({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [scrollable, value]);

  if (!scrollable) {
    return (
      <Stack direction="row" spacing={1.5} useFlexGap flexWrap="wrap">
        {items.map((item) => {
          const isActive = item.value === value;

          return (
            <Button
              key={item.value}
              variant="contained"
              onClick={() => onChange(item.value)}
              sx={{
                minWidth: { xs: 118, sm: 138, md: 150, xl: 170 },
                minHeight: { xs: 50, md: 54, xl: 60 },
                px: { xs: 1.5, md: 1.8, xl: 2.3 },
                backgroundImage: 'none',
                borderRadius: { xs: '14px', md: '18px' },
                backgroundColor: isActive ? 'var(--pos-tab-active-bg)' : 'var(--pos-tab-idle-bg)',
                color: isActive ? 'var(--pos-tab-active-color)' : 'var(--pos-tab-idle-color)',
                fontSize: { xs: 13.5, md: 14.5, xl: 15.5 },
                fontWeight: 600,
                boxShadow: isActive ? 'var(--pos-tab-active-shadow)' : 'none',
                '&:hover': {
                  backgroundColor: isActive ? 'var(--pos-tab-active-hover-bg)' : 'var(--pos-tab-idle-hover-bg)',
                },
              }}>
              {item.label}
            </Button>
          );
        })}
      </Stack>
    );
  }

  return (
    <Stack direction="row" alignItems="center" spacing={0.6} sx={{ minWidth: 0, flex: 1 }}>
      <IconButton
        aria-label="Oldingi kategoriyalar"
        onClick={() => scrollRail(-1)}
        sx={{
          flexShrink: 0,
          width: { xs: 38, md: 42 },
          height: { xs: 38, md: 42 },
          color: 'text.primary',
          backgroundColor: 'var(--pos-tab-idle-bg)',
          '&:hover': { backgroundColor: 'var(--pos-tab-idle-hover-bg)' },
        }}>
        <Icon icon="solar:alt-arrow-left-bold" width={20} />
      </IconButton>
      <Box
        ref={railRef}
        role="region"
        aria-label="Kategoriyalar"
        onWheel={handleWheel}
        sx={(theme) => ({
          flex: 1,
          minWidth: 0,
          overflowX: 'auto',
          overflowY: 'hidden',
          py: { xs: 0.55, md: 0.7 },
          px: { xs: 0.35, md: 0.45 },
          mx: { xs: -0.35, md: -0.45 },
          my: { xs: -0.55, md: -0.7 },
          scrollbarWidth: 'thin',
          scrollbarColor: `${alpha(theme.palette.text.primary, 0.28)} transparent`,
          WebkitOverflowScrolling: 'touch',
          '&::-webkit-scrollbar': { height: 8 },
          '&::-webkit-scrollbar-button': {
            display: 'none',
            width: 0,
            height: 0,
          },
          '&::-webkit-scrollbar-track': {
            backgroundColor: 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            borderRadius: 999,
            backgroundColor: alpha(theme.palette.text.primary, 0.28),
            border: '2px solid transparent',
            backgroundClip: 'content-box',
          },
          '&::-webkit-scrollbar-thumb:hover': {
            backgroundColor: alpha(theme.palette.text.primary, 0.38),
          },
        })}>
        <Stack direction="row" spacing={1.5} sx={{ width: 'max-content', minWidth: '100%' }}>
          {items.map((item, index) => {
            const isActive = item.value === value;

            return (
              <Button
                key={item.value}
                ref={(node) => {
                  tabRefs.current[item.value] = node;
                }}
                variant="contained"
                onClick={() => onChange(item.value)}
                sx={{
                  minWidth: { xs: 118, sm: 138, md: 150, xl: 170 },
                  minHeight: { xs: 50, md: 54, xl: 60 },
                  px: { xs: 1.55, md: 1.8, xl: 2.3 },
                  backgroundImage: 'none',
                  borderRadius: { xs: '14px', md: '18px' },
                  backgroundColor: isActive ? 'var(--pos-tab-active-bg)' : 'var(--pos-tab-idle-bg)',
                  color: isActive ? 'var(--pos-tab-active-color)' : 'var(--pos-tab-idle-color)',
                  fontSize: { xs: 13.5, md: 14.5, xl: 15.5 },
                  fontWeight: 600,
                  boxShadow: isActive ? 'var(--pos-tab-active-shadow)' : 'none',
                  justifyContent: 'center',
                  gap: 1,
                  flexShrink: 0,
                  '&:hover': {
                    backgroundColor: isActive ? 'var(--pos-tab-active-hover-bg)' : 'var(--pos-tab-idle-hover-bg)',
                  },
                }}>
                {item.label.trim() || `#${index + 1}`}
                {(item.count ?? 0) > 0 ? (
                  <Box
                    sx={(theme) => ({
                      minWidth: 26,
                      height: { xs: 22, md: 26 },
                      px: 0.8,
                      borderRadius: 999,
                      display: 'grid',
                      placeItems: 'center',
                      backgroundColor: isActive
                        ? alpha('#ffffff', 0.18)
                        : theme.palette.mode === 'dark'
                          ? '#1d1f23'
                          : '#ffffff',
                      color: isActive
                        ? '#ffffff'
                        : theme.palette.mode === 'dark'
                          ? '#f4f6f8'
                          : theme.palette.text.primary,
                      fontSize: { xs: 11.5, md: 13 },
                      fontWeight: 700,
                      lineHeight: 1,
                    })}>
                    {item.count}
                  </Box>
                ) : null}
              </Button>
            );
          })}
        </Stack>
      </Box>
      <IconButton
        aria-label="Keyingi kategoriyalar"
        onClick={() => scrollRail(1)}
        sx={{
          flexShrink: 0,
          width: { xs: 38, md: 42 },
          height: { xs: 38, md: 42 },
          color: 'text.primary',
          backgroundColor: 'var(--pos-tab-idle-bg)',
          '&:hover': { backgroundColor: 'var(--pos-tab-idle-hover-bg)' },
        }}>
        <Icon icon="solar:alt-arrow-right-bold" width={20} />
      </IconButton>
    </Stack>
  );
}
