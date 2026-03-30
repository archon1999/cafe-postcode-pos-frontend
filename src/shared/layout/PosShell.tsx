import { Box } from '@mui/material';
import type { ReactNode } from 'react';

import {
  canAccessCashier,
  canAccessCashierBuilder,
  canAccessKitchen,
  canAccessWaiter,
  shouldShowDock,
} from 'modules/auth/domain';
import { usePosSession } from 'modules/auth/ui/session-context';
import { useCashierOpenChecksCountQuery } from 'modules/cashier';
import { useKitchenActiveTicketCountQuery } from 'modules/kitchen';

import { getPosCopy } from '../locale/copy';
import { PosBottomDock } from '../ui/pos-primitives';

export function PosShell({ children }: { children: ReactNode }) {
  const { session, locale } = usePosSession();
  const copy = getPosCopy(locale);
  const featureConfig = session?.featureConfig ?? null;
  const cashierEnabled = canAccessCashier(session?.user, featureConfig);
  const kitchenEnabled = canAccessKitchen(session?.user, featureConfig);
  const waiterEnabled = canAccessWaiter(session?.user, featureConfig);
  const cashierBuilderEnabled = canAccessCashierBuilder(session?.user, featureConfig);

  const openChecksCountQuery = useCashierOpenChecksCountQuery(cashierEnabled);
  const kitchenActiveCountQuery = useKitchenActiveTicketCountQuery(kitchenEnabled);

  const dockItems = [
    waiterEnabled
      ? {
          key: 'halls',
          label: copy.halls,
          path: '/waiter/halls',
        }
      : null,
    cashierBuilderEnabled
      ? {
          key: 'builder',
          label: copy.counterMenu,
          path: '/cashier/builder',
        }
      : null,
    canAccessKitchen(session?.user, featureConfig)
      ? {
          key: 'kitchen',
          label: copy.kitchen,
          path: '/kitchen/queue',
          badge: kitchenActiveCountQuery.data,
        }
      : null,
    cashierEnabled
      ? {
          key: 'bills',
          label: copy.bills,
          path: '/cashier/open-checks',
          badge: openChecksCountQuery.data,
        }
      : null,
  ].filter(Boolean) as Array<{
    key: string;
    label: string;
    path: string;
    badge?: number;
  }>;

  return (
    <Box
      sx={(theme) => ({
        height: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        px: { xs: 1.25, sm: 1.6, md: 2.4, lg: 3.5 },
        pt: { xs: 1.25, sm: 1.6, md: 2.4, lg: 2.8 },
        background:
          theme.palette.mode === 'dark'
            ? 'linear-gradient(180deg, #1b1d20 0%, #1a1c1f 100%)'
            : 'linear-gradient(180deg, #f5ecdf 0%, #ebdfd0 100%)',
      })}>
      <Box component="main" sx={{ flex: '1 1 0', minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {children}
      </Box>

      {shouldShowDock(session) && dockItems.length > 0 ? <PosBottomDock items={dockItems} /> : null}
    </Box>
  );
}
