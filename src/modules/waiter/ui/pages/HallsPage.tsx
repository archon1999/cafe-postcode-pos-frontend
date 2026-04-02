import { Navigate } from 'react-router';

import { canAccessWaiter, getPosHomePath, isHallMode, usePosSession } from 'modules/auth';

import { HallsPageContent } from './HallsPage/HallsPageContent';

export function HallsPage() {
  const { session } = usePosSession();

  if (!isHallMode(session?.featureConfig ?? null)) {
    return <Navigate to={getPosHomePath(session)} replace />;
  }

  if (!canAccessWaiter(session?.user, session?.featureConfig ?? null)) {
    return <Navigate to={getPosHomePath(session)} replace />;
  }

  return <HallsPageContent />;
}
