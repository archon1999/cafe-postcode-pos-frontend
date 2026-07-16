import { Box, Drawer, Pagination, Stack, TextField, Typography } from '@mui/material';
import type { MouseEvent, ReactNode } from 'react';

import { getCashierOrderDisplayName, getCashierOrderNumberLabel } from 'modules/cashier/domain';
import type { CashierCheckStatus, CashierOrder } from 'modules/cashier/domain/entities/order.types';
import { getPosCopy, type PosLocale } from 'shared/locale/copy';
import { PosIconAction, PosSectionTabs } from 'shared/ui/pos-primitives';

import { OpenChecksList } from './OpenChecksList';

type OpenChecksHeaderProps = {
  copy: ReturnType<typeof getPosCopy>;
  fiscalCount: number;
  isMobile: boolean;
  openCount: number;
  closedCount: number;
  selectedTab: CashierCheckStatus;
  onLock: () => void;
  onRefresh: () => void;
  onSettings: (event: MouseEvent<HTMLElement>) => void;
  onTabChange: (status: CashierCheckStatus) => void;
};

export function OpenChecksHeader({
  copy,
  fiscalCount,
  isMobile,
  openCount,
  closedCount,
  selectedTab,
  onLock,
  onRefresh,
  onSettings,
  onTabChange,
}: OpenChecksHeaderProps) {
  return (
    <Stack direction="row" spacing={1.5} justifyContent="space-between" alignItems="center">
      <PosSectionTabs
        value={selectedTab}
        onChange={(value) => onTabChange(value as CashierCheckStatus)}
        items={[
          { value: 'open', label: `${copy.openChecks} (${openCount})` },
          { value: 'closed', label: `${copy.closedChecks} (${closedCount})` },
          { value: 'fiscal_closed', label: `${copy.fiscalChecks} (${fiscalCount})` },
        ]}
      />
      <Stack direction="row" spacing={1.5}>
        {!isMobile ? <PosIconAction icon="solar:refresh-bold-duotone" onClick={onRefresh} /> : null}
        <PosIconAction icon="solar:settings-bold-duotone" onClick={onSettings} />
        {!isMobile ? <PosIconAction icon="solar:lock-password-bold-duotone" onClick={onLock} /> : null}
      </Stack>
    </Stack>
  );
}

type OpenChecksListPanelProps = {
  copy: ReturnType<typeof getPosCopy>;
  locale: PosLocale;
  orders: CashierOrder[];
  page: number;
  pageCount: number;
  paged: boolean;
  search: string;
  selectedOrderId?: string;
  selectedTab: CashierCheckStatus;
  onPageChange: (page: number) => void;
  onRename: (order: CashierOrder) => void;
  onSearchChange: (value: string) => void;
  onSelect: (orderId: string) => void;
  onSwipeEdit: (order: CashierOrder) => void;
};

export function OpenChecksListPanel({
  copy,
  locale,
  orders,
  page,
  pageCount,
  paged,
  search,
  selectedOrderId,
  selectedTab,
  onPageChange,
  onRename,
  onSearchChange,
  onSelect,
  onSwipeEdit,
}: OpenChecksListPanelProps) {
  return (
    <Stack spacing={1.2} sx={{ height: '100%', minHeight: 0 }}>
      {paged ? (
        <TextField
          size="small"
          placeholder="Qidirish"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          sx={{ maxWidth: { md: 360 } }}
        />
      ) : null}
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <OpenChecksList
          copy={copy}
          locale={locale}
          orders={orders}
          selectedOrderId={selectedOrderId}
          selectedTab={selectedTab}
          onRename={onRename}
          onSwipeEdit={onSwipeEdit}
          onSelect={onSelect}
        />
      </Box>
      {paged ? (
        <Stack direction="row" justifyContent="center" sx={{ flexShrink: 0, pt: 0.2 }}>
          <Pagination count={pageCount} page={page} onChange={(_, value) => onPageChange(value)} shape="rounded" />
        </Stack>
      ) : null}
    </Stack>
  );
}

type OpenChecksMobileDetailProps = {
  copy: ReturnType<typeof getPosCopy>;
  detail: ReactNode;
  open: boolean;
  order?: CashierOrder;
  onClose: () => void;
};

export function OpenChecksMobileDetail({ copy, detail, open, order, onClose }: OpenChecksMobileDetailProps) {
  return (
    <Drawer
      anchor="bottom"
      open={open && Boolean(detail)}
      onClose={onClose}
      PaperProps={{
        sx: {
          height: 'min(82dvh, 860px)',
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          backgroundImage: 'none',
          overflow: 'hidden',
        },
      }}>
      <Stack sx={{ height: '100%', minHeight: 0 }}>
        <Stack direction="row" spacing={1.2} alignItems="center" justifyContent="space-between" sx={{ px: 2, py: 1.5 }}>
          <Stack spacing={0.25}>
            <Typography variant="h6">{copy.bills}</Typography>
            <Typography variant="body2" color="text.secondary">
              {order ? getCashierOrderDisplayName(order) : copy.orders}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {order ? getCashierOrderNumberLabel(order) : copy.orders}
            </Typography>
          </Stack>
          <PosIconAction icon="solar:close-circle-bold-duotone" onClick={onClose} />
        </Stack>
        <Box sx={{ flex: 1, minHeight: 0, px: 2, pb: 2 }}>{detail}</Box>
      </Stack>
    </Drawer>
  );
}
