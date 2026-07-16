import { Stack } from '@mui/material';
import type { MouseEvent } from 'react';

import { PosIconAction, PosSectionTabs } from 'shared/ui/pos-primitives';

type CategoryTab = {
  value: string;
  label: string;
  count: number;
};

type CashierBuilderHeaderProps = {
  categoryId: string;
  categoryTabs: CategoryTab[];
  isMobile: boolean;
  onCategoryChange: (categoryId: string) => void;
  onMenuOpen: () => void;
  onRefresh: () => void;
  onSettingsOpen: (event: MouseEvent<HTMLElement>) => void;
  onLock: () => void;
};

export function CashierBuilderHeader({
  categoryId,
  categoryTabs,
  isMobile,
  onCategoryChange,
  onMenuOpen,
  onRefresh,
  onSettingsOpen,
  onLock,
}: CashierBuilderHeaderProps) {
  return (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      spacing={{ xs: 1.1, md: 1.5 }}
      justifyContent="space-between"
      alignItems={{ xs: 'stretch', md: 'flex-start' }}>
      <Stack sx={{ flex: 1, minWidth: 0 }}>
        <PosSectionTabs value={categoryId} items={categoryTabs} onChange={onCategoryChange} scrollable />
      </Stack>

      <Stack direction="row" spacing={{ xs: 1, md: 1.5 }} sx={{ justifyContent: { xs: 'flex-end', md: 'flex-start' } }}>
        <PosIconAction icon="solar:chef-hat-bold-duotone" onClick={onMenuOpen} />
        {!isMobile ? <PosIconAction icon="solar:refresh-bold-duotone" onClick={onRefresh} /> : null}
        <PosIconAction icon="solar:settings-bold-duotone" onClick={onSettingsOpen} />
        {!isMobile ? <PosIconAction icon="solar:lock-password-bold-duotone" onClick={onLock} /> : null}
      </Stack>
    </Stack>
  );
}
