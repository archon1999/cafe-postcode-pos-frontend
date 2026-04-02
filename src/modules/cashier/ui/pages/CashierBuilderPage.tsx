import { Navigate } from 'react-router';

import { getPosHomePath, isCashierBuilderMode, usePosSession } from 'modules/auth';

import { CashierBuilderPageContent } from './CashierBuilderPage/CashierBuilderPageContent';

export function CashierBuilderPage() {
  const { session } = usePosSession();

  if (!isCashierBuilderMode(session?.featureConfig ?? null)) {
    return <Navigate to={getPosHomePath(session)} replace />;
  }

  return <CashierBuilderPageContent />;
}
