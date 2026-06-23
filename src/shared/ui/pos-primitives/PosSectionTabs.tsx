import { Icon } from '@iconify/react';
import { Box, Button, Stack, alpha } from '@mui/material';
import { useEffect, useRef, useState } from 'react';

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
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  useEffect(() => {
    if (!scrollable) {
      return;
    }

    const rail = railRef.current;
    if (!rail) {
      return;
    }

    const updateScrollState = () => {
      const maxScrollLeft = rail.scrollWidth - rail.clientWidth;
      setCanScrollPrev(rail.scrollLeft > 4);
      setCanScrollNext(maxScrollLeft - rail.scrollLeft > 4);
    };

    updateScrollState();
    rail.addEventListener('scroll', updateScrollState);
    window.addEventListener('resize', updateScrollState);

    return () => {
      rail.removeEventListener('scroll', updateScrollState);
      window.removeEventListener('resize', updateScrollState);
    };
  }, [items, scrollable]);

  useEffect(() => {
    if (!scrollable) {
      return;
    }

    const activeTab = tabRefs.current[value];
    if (activeTab) {
      activeTab.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
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
              sx={(theme) => ({
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
              })}>
              {item.label}
            </Button>
          );
        })}
      </Stack>
    );
  }

  const handleScroll = (direction: 'prev' | 'next') => {
    const rail = railRef.current;
    if (!rail) {
      return;
    }

    const delta = Math.max(220, Math.floor(rail.clientWidth * 0.58));
    rail.scrollBy({
      left: direction === 'prev' ? -delta : delta,
      behavior: 'smooth',
    });
  };

  const scrollButtonSx = (enabled: boolean) => (theme: any) => ({
    minWidth: { xs: 42, sm: 46, md: 52, xl: 60 },
    width: { xs: 42, sm: 46, md: 52, xl: 60 },
    height: { xs: 42, sm: 46, md: 52, xl: 60 },
    p: 0,
    borderRadius: { xs: '14px', md: '18px' },
    backgroundImage: 'none',
    backgroundColor: 'var(--pos-tab-idle-bg)',
    color: theme.palette.mode === 'dark' ? '#d7dbe0' : theme.palette.text.primary,
    opacity: enabled ? 1 : 0,
    pointerEvents: enabled ? 'auto' : 'none',
    transform: enabled ? 'translateY(0)' : 'translateY(6px)',
    transition: 'opacity 0.18s ease, transform 0.18s ease, background-color 0.18s ease',
    '&:hover': {
      backgroundColor: 'var(--pos-tab-idle-hover-bg)',
    },
    '&:active': {
      transform: 'scale(0.96)',
    },
  });

  return (
    <Stack direction="row" spacing={{ xs: 1, md: 1.5 }} alignItems="center" sx={{ minWidth: 0, flex: 1 }}>
      <Button variant="contained" onClick={() => handleScroll('prev')} sx={scrollButtonSx(canScrollPrev)}>
        <Icon icon="solar:alt-arrow-left-bold" width={22} />
      </Button>

      <Box
        ref={railRef}
        sx={{
          flex: 1,
          minWidth: 0,
          overflowX: 'hidden',
          py: { xs: 0.55, md: 0.7 },
          px: { xs: 0.35, md: 0.45 },
          mx: { xs: -0.35, md: -0.45 },
          my: { xs: -0.55, md: -0.7 },
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': { display: 'none' },
        }}>
        <Stack direction="row" spacing={1.5} sx={{ width: 'max-content', minWidth: '100%' }}>
          {items.map((item) => {
            const isActive = item.value === value;

            return (
              <Button
                key={item.value}
                ref={(node) => {
                  tabRefs.current[item.value] = node;
                }}
                variant="contained"
                onClick={() => onChange(item.value)}
                sx={(theme) => ({
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
                })}>
                {item.label}
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

      <Button variant="contained" onClick={() => handleScroll('next')} sx={scrollButtonSx(canScrollNext)}>
        <Icon icon="solar:alt-arrow-right-bold" width={22} />
      </Button>
    </Stack>
  );
}
