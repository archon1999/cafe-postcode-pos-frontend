import type { ReactElement } from 'react';
import { Navigate, createBrowserRouter } from 'react-router';

import {
  LoginPage,
  DevicePairingPage,
  DeviceRevokedPage,
  PosAuthenticatedLayout,
  PosDevicePairingRoute,
  PosEmployeeRoute,
  PosLockRoute,
  PosPinRoute,
  PosRevokedDeviceRoute,
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
import { KitchenMonitorPage, KitchenQueuePage, TvMonitorPage } from 'modules/kitchen';
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

export const posRouter = createBrowserRouter([
  {
    path: '/device-pairing',
    element: (
      <PosDevicePairingRoute>
        <DevicePairingPage />
      </PosDevicePairingRoute>
    ),
  },
  {
    path: '/device-revoked',
    element: (
      <PosRevokedDeviceRoute>
        <DeviceRevokedPage />
      </PosRevokedDeviceRoute>
    ),
  },
  {
    path: '/pin-login',
    element: (
      <PosPinRoute>
        <LoginPage />
      </PosPinRoute>
    ),
  },
  {
    path: '/monitor/queue',
    element: (
      <PosEmployeeRoute>
        <KitchenMonitorPage />
      </PosEmployeeRoute>
    ),
  },
  {
    path: '/monitoring/queue',
    element: (
      <PosEmployeeRoute>
        <KitchenMonitorPage />
      </PosEmployeeRoute>
    ),
  },
  { path: '/tv', element: <TvMonitorPage /> },
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
    ],
  },
  {
    path: '/lock-screen',
    element: (
      <PosLockRoute>
        <LockScreenPage />
      </PosLockRoute>
    ),
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
