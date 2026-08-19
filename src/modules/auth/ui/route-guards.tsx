import { useEffect, type ReactNode } from 'react';
import { Navigate, Outlet } from 'react-router';

import { PosShell } from 'shared/layout/PosShell';

import { getPosHomePath } from '../domain';

import { DeviceBootstrapPage } from './pages';
import { usePosSession } from './session-context';

function deviceRedirect(authState: ReturnType<typeof usePosSession>['authState']) {
  if (authState === 'UNPAIRED' || authState === 'PAIRING') return '/device-pairing';
  if (authState === 'REVOKED') return '/device-revoked';
  return null;
}

export function PosPinRoute({ children }: { children: ReactNode }) {
  const { authState, isBootstrapping, session } = usePosSession();
  if (isBootstrapping) return <DeviceBootstrapPage />;
  const redirect = deviceRedirect(authState);
  if (redirect) return <Navigate to={redirect} replace />;
  if (authState === 'AUTHENTICATED') return <Navigate to={getPosHomePath(session)} replace />;
  return <>{children}</>;
}

export function PosDevicePairingRoute({ children }: { children: ReactNode }) {
  const { authState, isBootstrapping, session } = usePosSession();
  if (isBootstrapping) return <DeviceBootstrapPage />;
  if (authState === 'REVOKED') return <Navigate to="/device-revoked" replace />;
  if (authState === 'PAIRED_NO_USER' || authState === 'LOCKED') return <Navigate to="/pin-login" replace />;
  if (authState === 'AUTHENTICATED') return <Navigate to={getPosHomePath(session)} replace />;
  return <>{children}</>;
}

export function PosRevokedDeviceRoute({ children }: { children: ReactNode }) {
  const { authState, isBootstrapping, session } = usePosSession();
  if (isBootstrapping) return <DeviceBootstrapPage />;
  if (authState === 'REVOKED') return <>{children}</>;
  if (authState === 'UNPAIRED' || authState === 'PAIRING') return <Navigate to="/device-pairing" replace />;
  if (authState === 'PAIRED_NO_USER' || authState === 'LOCKED') return <Navigate to="/pin-login" replace />;
  return <Navigate to={getPosHomePath(session)} replace />;
}

export function PosLockRoute({ children }: { children: ReactNode }) {
  const { authState, isBootstrapping, lockSession, session } = usePosSession();
  if (isBootstrapping) return <DeviceBootstrapPage />;
  const redirect = deviceRedirect(authState);
  if (redirect) return <Navigate to={redirect} replace />;
  if (authState === 'LOCKED') return <>{children}</>;
  if (authState === 'PAIRED_NO_USER') return <Navigate to="/pin-login" replace />;
  if (authState === 'AUTHENTICATED') return <LockCurrentSession lockSession={lockSession} />;
  return <Navigate to={getPosHomePath(session)} replace />;
}

function LockCurrentSession({ lockSession }: { lockSession: () => Promise<void> }) {
  useEffect(() => {
    void lockSession();
  }, [lockSession]);
  return <DeviceBootstrapPage />;
}

export function PosEmployeeRoute({ children }: { children: ReactNode }) {
  const { authState, isBootstrapping } = usePosSession();
  if (isBootstrapping) return <DeviceBootstrapPage />;
  const redirect = deviceRedirect(authState);
  if (redirect) return <Navigate to={redirect} replace />;
  if (authState === 'LOCKED') return <Navigate to="/lock-screen" replace />;
  if (authState !== 'AUTHENTICATED') return <Navigate to="/pin-login" replace />;
  return <>{children}</>;
}

export function PosAuthenticatedLayout() {
  const { authState, isBootstrapping } = usePosSession();
  if (isBootstrapping) return <DeviceBootstrapPage />;
  const redirect = deviceRedirect(authState);
  if (redirect) return <Navigate to={redirect} replace />;
  if (authState === 'LOCKED') return <Navigate to="/lock-screen" replace />;
  if (authState !== 'AUTHENTICATED') return <Navigate to="/pin-login" replace />;
  return (
    <PosShell>
      <Outlet />
    </PosShell>
  );
}
