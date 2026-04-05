import { Navigate } from 'react-router';

import { canAccessTakeawayBuilder, getPosHomePath, usePosSession } from 'modules/auth';

import { CashierBuilderPageContent } from './CashierBuilderPage/CashierBuilderPageContent';

export function CashierBuilderPage() {
  const { session } = usePosSession();

  if (!canAccessTakeawayBuilder(session?.user)) {
    return <Navigate to={getPosHomePath(session)} replace />;
  }

  return <CashierBuilderPageContent />;
}
