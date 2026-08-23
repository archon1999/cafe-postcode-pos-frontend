import { Button, Stack } from '@mui/material';

import type { getPosCopy } from 'shared/locale/copy';
import { PosIconAction } from 'shared/ui/pos-primitives';

export type KitchenQueueTab = 'active' | 'done';

type KitchenQueueHeaderProps = {
  activeCount: number;
  copy: ReturnType<typeof getPosCopy>;
  doneCount: number;
  isMobile: boolean;
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
        <Stack direction="row" spacing={{ xs: 1, md: 1.5 }} sx={{ flex: 1, minWidth: 0, maxWidth: 1220 }}>
          {tabs.map((item) => {
            const active = selectedTab === item.value;
            return (
              <Button
                key={item.value}
                variant="contained"
                onClick={() => onSelectTab(item.value)}
                sx={{
                  flex: 1,
                  minHeight: { xs: 56, md: 70 },
                  borderRadius: { xs: '14px', md: '16px' },
                  background: active ? 'var(--pos-primary-gradient)' : 'var(--pos-tab-idle-bg)',
                  color: active ? 'var(--pos-tab-active-color)' : 'var(--pos-tab-idle-color)',
                  fontSize: { xs: 14, md: 17 },
                  fontWeight: 600,
                  justifyContent: 'center',
                  border: `1px solid ${active ? 'transparent' : 'var(--pos-accent-border)'}`,
                  boxShadow: active ? 'var(--pos-tab-active-shadow)' : 'none',
                  '&:hover': {
                    background: active ? 'var(--pos-tab-active-hover-bg)' : 'var(--pos-tab-idle-hover-bg)',
                  },
                }}>
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
