import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';

import { PosShell } from 'shared/layout/PosShell';

import { getPosHomePath } from '../domain';

import { resolveAuthNextPath } from './next-path';
import { usePosSession } from './session-context';

export function PosPublicOnlyRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, restaurantContext, session } = usePosSession();

  if (isAuthenticated) {
    return <Navigate to={getPosHomePath(session)} replace />;
  }

  if (!restaurantContext) {
    return <Navigate to="/restaurant-login" replace />;
  }

  return <>{children}</>;
}

export function PosRestaurantPublicOnlyRoute({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { isAuthenticated, restaurantContext, session } = usePosSession();

  if (isAuthenticated) {
    return <Navigate to={getPosHomePath(session)} replace />;
  }

  if (restaurantContext) {
    return <Navigate to={resolveAuthNextPath(location.search)} replace />;
  }

  return <>{children}</>;
}

export function PosAuthenticatedLayout() {
  const location = useLocation();
  const { isAuthenticated, restaurantContext } = usePosSession();

  if (!restaurantContext) {
    return <Navigate to="/restaurant-login" replace />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/pin-login" replace />;
  }

  if (location.pathname === '/lock-screen') {
    return <Outlet />;
  }

  return (
    <PosShell>
      <Outlet />
    </PosShell>
  );
}
