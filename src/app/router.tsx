import type { ReactElement } from 'react';
import { Navigate, createBrowserRouter, useLocation } from 'react-router';

import {
  LoginPage,
  PosAuthenticatedLayout,
  PosPublicOnlyRoute,
  PosRestaurantPublicOnlyRoute,
  RestaurantLoginPage,
  canAccessTakeawayBuilder,
  canAccessCashierPayments,
  canCreateCashExpense,
  canViewCashShift,
  canAccessKitchen,
  canAccessWaiter,
  canAccessWaiterTables,
  getPosHomePath,
  usePosSession,
} from 'modules/auth';
import { CashExpensesPage, CashierBuilderPage, CashierShiftPage, OpenChecksPage, PaymentPage } from 'modules/cashier';
import { KitchenMonitorPage, KitchenQueuePage, TvMonitorPage, TvMonitorPairingClaimPage } from 'modules/kitchen';
import { MenuCatalogPage } from 'modules/menu-catalog';
import { HallsPage, TableSessionPage } from 'modules/waiter';

import { LockScreenPage } from '../shared/layout/LockScreenPage';

function PosHomeRedirect() {
  const { session } = usePosSession();
  return <Navigate to={getPosHomePath(session)} replace />;
}

function PosAccessGuard({
  children,
  canAccess,
}: {
  children: ReactElement;
  canAccess: (session: ReturnType<typeof usePosSession>['session']) => boolean;
}) {
  const { session } = usePosSession();

  if (!canAccess(session)) {
    return <Navigate to={getPosHomePath(session)} replace />;
  }

  return children;
}

function PosMonitorRestaurantGuard({ children }: { children: ReactElement }) {
  const location = useLocation();
  const { restaurantContext } = usePosSession();

  if (!restaurantContext) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/restaurant-login?next=${next}`} replace />;
  }

  return children;
}

function PosEmployeeGuard({ children }: { children: ReactElement }) {
  const location = useLocation();
  const { isAuthenticated, restaurantContext } = usePosSession();
  const next = encodeURIComponent(`${location.pathname}${location.search}`);

  if (!restaurantContext) return <Navigate to={`/restaurant-login?next=${next}`} replace />;
  if (!isAuthenticated) return <Navigate to={`/pin-login?next=${next}`} replace />;
  return children;
}

export const posRouter = createBrowserRouter([
  {
    path: '/restaurant-login',
    element: (
      <PosRestaurantPublicOnlyRoute>
        <RestaurantLoginPage />
      </PosRestaurantPublicOnlyRoute>
    ),
  },
  {
    path: '/pin-login',
    element: (
      <PosPublicOnlyRoute>
        <LoginPage />
      </PosPublicOnlyRoute>
    ),
  },
  {
    path: '/monitor/queue',
    element: (
      <PosMonitorRestaurantGuard>
        <KitchenMonitorPage />
      </PosMonitorRestaurantGuard>
    ),
  },
  {
    path: '/monitoring/queue',
    element: (
      <PosMonitorRestaurantGuard>
        <KitchenMonitorPage />
      </PosMonitorRestaurantGuard>
    ),
  },
  { path: '/tv', element: <TvMonitorPage /> },
  {
    path: '/tv/pair/:pairingId',
    element: (
      <PosEmployeeGuard>
        <TvMonitorPairingClaimPage />
      </PosEmployeeGuard>
    ),
  },
  {
    path: '/',
    element: <PosAuthenticatedLayout />,
    children: [
      { index: true, element: <PosHomeRedirect /> },
      {
        path: 'waiter/halls',
        element: (
          <PosAccessGuard canAccess={(session) => canAccessWaiter(session?.user)}>
            <HallsPage />
          </PosAccessGuard>
        ),
      },
      {
        path: 'waiter/table-session',
        element: (
          <PosAccessGuard canAccess={(session) => canAccessWaiterTables(session?.user)}>
            <TableSessionPage />
          </PosAccessGuard>
        ),
      },
      {
        path: 'cashier/builder',
        element: (
          <PosAccessGuard canAccess={(session) => canAccessTakeawayBuilder(session?.user)}>
            <CashierBuilderPage />
          </PosAccessGuard>
        ),
      },
      {
        path: 'cashier/open-checks',
        element: (
          <PosAccessGuard canAccess={(session) => canAccessCashierPayments(session?.user)}>
            <OpenChecksPage />
          </PosAccessGuard>
        ),
      },
      {
        path: 'cashier/expenses',
        element: (
          <PosAccessGuard canAccess={(session) => canCreateCashExpense(session?.user)}>
            <CashExpensesPage />
          </PosAccessGuard>
        ),
      },
      {
        path: 'cashier/shift',
        element: (
          <PosAccessGuard canAccess={(session) => canViewCashShift(session?.user)}>
            <CashierShiftPage />
          </PosAccessGuard>
        ),
      },
      {
        path: 'cashier/payment',
        element: (
          <PosAccessGuard canAccess={(session) => canAccessCashierPayments(session?.user)}>
            <PaymentPage />
          </PosAccessGuard>
        ),
      },
      {
        path: 'menu/catalog',
        element: <MenuCatalogPage />,
      },
      {
        path: 'kitchen/queue',
        element: (
          <PosAccessGuard canAccess={(session) => canAccessKitchen(session?.user)}>
            <KitchenQueuePage />
          </PosAccessGuard>
        ),
      },
      { path: 'lock-screen', element: <LockScreenPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
