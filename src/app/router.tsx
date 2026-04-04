import type { ReactElement } from 'react';
import { Navigate, createBrowserRouter } from 'react-router';

import {
  LoginPage,
  PosAuthenticatedLayout,
  PosPublicOnlyRoute,
  PosRestaurantPublicOnlyRoute,
  RestaurantLoginPage,
  canAccessTakeawayBuilder,
  canAccessCashierPayments,
  canAccessKitchen,
  canAccessWaiter,
  canAccessWaiterTables,
  getPosHomePath,
  usePosSession,
} from 'modules/auth';
import { CashierBuilderPage, OpenChecksPage, PaymentPage } from 'modules/cashier';
import { KitchenQueuePage } from 'modules/kitchen';
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
    path: '/',
    element: <PosAuthenticatedLayout />,
    children: [
      { index: true, element: <PosHomeRedirect /> },
      {
        path: 'waiter/halls',
        element: (
          <PosAccessGuard canAccess={(session) => canAccessWaiter(session?.user, session?.featureConfig ?? null)}>
            <HallsPage />
          </PosAccessGuard>
        ),
      },
      {
        path: 'waiter/table-session',
        element: (
          <PosAccessGuard canAccess={(session) => canAccessWaiterTables(session?.user, session?.featureConfig ?? null)}>
            <TableSessionPage />
          </PosAccessGuard>
        ),
      },
      {
        path: 'cashier/builder',
        element: (
          <PosAccessGuard
            canAccess={(session) => canAccessTakeawayBuilder(session?.user, session?.featureConfig ?? null)}>
            <CashierBuilderPage />
          </PosAccessGuard>
        ),
      },
      {
        path: 'cashier/open-checks',
        element: (
          <PosAccessGuard
            canAccess={(session) => canAccessCashierPayments(session?.user, session?.featureConfig ?? null)}>
            <OpenChecksPage />
          </PosAccessGuard>
        ),
      },
      {
        path: 'cashier/payment',
        element: (
          <PosAccessGuard
            canAccess={(session) => canAccessCashierPayments(session?.user, session?.featureConfig ?? null)}>
            <PaymentPage />
          </PosAccessGuard>
        ),
      },
      {
        path: 'kitchen/queue',
        element: (
          <PosAccessGuard canAccess={(session) => canAccessKitchen(session?.user, session?.featureConfig ?? null)}>
            <KitchenQueuePage />
          </PosAccessGuard>
        ),
      },
      { path: 'lock-screen', element: <LockScreenPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
