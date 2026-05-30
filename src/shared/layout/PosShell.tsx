import { Box } from '@mui/material';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router';

import {
  canAccessCashierPayments,
  canAccessTakeawayBuilder,
  canAccessKitchen,
  canAccessWaiter,
} from 'modules/auth/domain';
import { usePosSession } from 'modules/auth/ui/session-context';
import { useCashierOpenChecksCountQuery } from 'modules/cashier';
import { useKitchenActiveTicketCountQuery } from 'modules/kitchen';

import { getPosCopy } from '../locale/copy';
import { PosBottomDock } from '../ui/pos-primitives';

export function PosShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { session, locale } = usePosSession();
  const copy = getPosCopy(locale);
  const cashierEnabled = canAccessCashierPayments(session?.user);
  const kitchenEnabled = canAccessKitchen(session?.user);
  const waiterEnabled = canAccessWaiter(session?.user);
  const cashierBuilderEnabled = canAccessTakeawayBuilder(session?.user);
  const isCatalogPage = location.pathname === '/menu/catalog';

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
    kitchenEnabled
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
        px: isCatalogPage ? 0 : { xs: 1.25, sm: 1.6, md: 2.4, lg: 3.5 },
        pt: isCatalogPage ? 0 : { xs: 1.25, sm: 1.6, md: 2.4, lg: 2.8 },
        background: isCatalogPage
          ? '#050505'
          : theme.palette.mode === 'dark'
            ? 'linear-gradient(180deg, #1b1d20 0%, #1a1c1f 100%)'
            : 'linear-gradient(180deg, #f5ecdf 0%, #ebdfd0 100%)',
      })}>
      <Box
        component="main"
        sx={{ flex: '1 1 0', minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {children}
      </Box>

      {dockItems.length > 1 && !isCatalogPage ? <PosBottomDock items={dockItems} /> : null}
    </Box>
  );
}
