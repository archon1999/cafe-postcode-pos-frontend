import { Navigate } from 'react-router';

import { canAccessKitchen, getPosHomePath, usePosSession } from 'modules/auth';

import { KitchenQueuePageContent } from './KitchenQueuePage/KitchenQueuePageContent';

export function KitchenQueuePage() {
  const { session } = usePosSession();

  if (!canAccessKitchen(session?.user)) {
    return <Navigate to={getPosHomePath(session)} replace />;
  }

  return <KitchenQueuePageContent />;
}
