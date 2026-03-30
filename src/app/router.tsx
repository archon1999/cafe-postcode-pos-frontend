import type { ReactElement } from 'react';
import { Navigate, createBrowserRouter, useLocation } from 'react-router';

import {
  LoginPage,
  PosAuthenticatedLayout,
  PosPublicOnlyRoute,
  PosRestaurantPublicOnlyRoute,
  RestaurantLoginPage,
  canAccessCashier,
  canAccessCashierBuilder,
  canAccessCashierPayments,
  canAccessKitchen,
  canAccessWaiter,
  getPosHomePath,
  usePosSession,
} from 'modules/auth';
import { CashierBuilderPage, CashierShiftPage, OpenChecksPage, PaymentPage, useCashierContextQuery } from 'modules/cashier';
import { KitchenQueuePage } from 'modules/kitchen';
import { HallsPage, TableSessionPage } from 'modules/waiter';
import { LockScreenPage } from '../shared/layout/LockScreenPage';

function PosHomeRedirect() {
  const { session } = usePosSession();
  return <Navigate to={getPosHomePath(session)} replace />;
}

function CashierShiftGuard({ children }: { children: ReactElement }) {
  const location = useLocation();
  const { session } = usePosSession();
  const hasCashierAccess = canAccessCashier(session?.user, session?.featureConfig ?? null);
  const contextQuery = useCashierContextQuery({ enabled: hasCashierAccess });

  if (!hasCashierAccess) {
    return <Navigate to={getPosHomePath(session)} replace />;
  }

  if (contextQuery.isLoading && !contextQuery.data) {
    return null;
  }

  if (!contextQuery.data?.currentShift) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/cashier/shift?next=${next}`} replace />;
  }

  return children;
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
      { path: 'waiter/halls', element: <HallsPage /> },
      {
        path: 'waiter/table-session',
        element: (
          <PosAccessGuard canAccess={(session) => canAccessWaiter(session?.user, session?.featureConfig ?? null)}>
            <TableSessionPage />
          </PosAccessGuard>
        ),
      },
      {
        path: 'cashier/shift',
        element: <CashierShiftPage />,
      },
      {
        path: 'cashier/builder',
        element: (
          <PosAccessGuard canAccess={(session) => canAccessCashierBuilder(session?.user, session?.featureConfig ?? null)}>
            <CashierShiftGuard>
              <CashierBuilderPage />
            </CashierShiftGuard>
          </PosAccessGuard>
        ),
      },
      {
        path: 'cashier/open-checks',
        element: (
          <PosAccessGuard canAccess={(session) => canAccessCashierPayments(session?.user, session?.featureConfig ?? null)}>
            <CashierShiftGuard>
              <OpenChecksPage />
            </CashierShiftGuard>
          </PosAccessGuard>
        ),
      },
      {
        path: 'cashier/payment',
        element: (
          <PosAccessGuard canAccess={(session) => canAccessCashierPayments(session?.user, session?.featureConfig ?? null)}>
            <CashierShiftGuard>
              <PaymentPage />
            </CashierShiftGuard>
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
