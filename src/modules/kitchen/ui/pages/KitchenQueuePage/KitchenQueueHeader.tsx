import { alpha, Button, Stack } from '@mui/material';

import type { getPosCopy } from 'shared/locale/copy';
import { PosIconAction } from 'shared/ui/pos-primitives';

export type KitchenQueueTab = 'active' | 'done';

type KitchenQueueHeaderProps = {
  activeCount: number;
  copy: ReturnType<typeof getPosCopy>;
  doneCount: number;
  isMobile: boolean;
  onBack: () => void;
  onLock: () => void;
  onRefresh: () => void;
  onSelectTab: (tab: KitchenQueueTab) => void;
  onSettings: (anchor: HTMLElement) => void;
  selectedTab: KitchenQueueTab;
};

export function KitchenQueueHeader({
  activeCount,
  copy,
  doneCount,
  isMobile,
  onBack,
  onLock,
  onRefresh,
  onSelectTab,
  onSettings,
  selectedTab,
}: KitchenQueueHeaderProps) {
  const tabs: Array<{ value: KitchenQueueTab; label: string }> = [
    { value: 'active', label: `${copy.activeOrders} (${activeCount})` },
    { value: 'done', label: `${isMobile ? copy.done : copy.completedOrders} (${doneCount})` },
  ];

  return (
    <Stack
      direction="row"
      spacing={{ xs: 1, md: 1.5 }}
      justifyContent="space-between"
      alignItems="center"
      sx={{ flexWrap: 'nowrap' }}>
      <Stack direction="row" spacing={{ xs: 1, md: 1.5 }} sx={{ flex: 1, minWidth: 0 }}>
        {!isMobile ? <PosIconAction icon="solar:alt-arrow-left-bold" onClick={onBack} /> : null}

        <Stack direction="row" spacing={{ xs: 1, md: 1.5 }} sx={{ flex: 1, minWidth: 0, maxWidth: 1220 }}>
          {tabs.map((item) => {
            const active = selectedTab === item.value;
            return (
              <Button
                key={item.value}
                variant="contained"
                onClick={() => onSelectTab(item.value)}
                sx={(theme) => ({
                  flex: 1,
                  minHeight: { xs: 56, md: 70 },
                  borderRadius: { xs: '14px', md: '16px' },
                  backgroundImage: 'none',
                  backgroundColor: active
                    ? theme.palette.primary.main
                    : theme.palette.mode === 'dark'
                      ? '#2b2d31'
                      : alpha('#fffaf3', 0.94),
                  color: active ? '#ffffff' : theme.palette.mode === 'dark' ? '#a2a6ad' : '#5f6773',
                  fontSize: { xs: 14, md: 17 },
                  fontWeight: 600,
                  justifyContent: 'center',
                  border: `1px solid ${
                    active
                      ? 'transparent'
                      : alpha(
                          theme.palette.mode === 'dark' ? '#ffffff' : '#6c5330',
                          theme.palette.mode === 'dark' ? 0 : 0.1,
                        )
                  }`,
                  boxShadow: active
                    ? '0 12px 22px rgba(27,132,236,0.24)'
                    : theme.palette.mode === 'dark'
                      ? 'none'
                      : '0 12px 24px rgba(78, 55, 28, 0.08)',
                  '&:hover': {
                    backgroundColor: active
                      ? theme.palette.primary.dark
                      : theme.palette.mode === 'dark'
                        ? '#303339'
                        : '#f4ecdf',
                  },
                })}>
                {item.label}
              </Button>
            );
          })}
        </Stack>
      </Stack>

      <Stack direction="row" spacing={{ xs: 1, md: 1.5 }} sx={{ justifyContent: { xs: 'flex-end', md: 'flex-start' } }}>
        {!isMobile ? <PosIconAction icon="solar:refresh-bold-duotone" onClick={onRefresh} /> : null}
        <PosIconAction icon="solar:settings-bold-duotone" onClick={(event) => onSettings(event.currentTarget)} />
        {!isMobile ? <PosIconAction icon="solar:lock-password-bold-duotone" onClick={onLock} /> : null}
      </Stack>
    </Stack>
  );
}
