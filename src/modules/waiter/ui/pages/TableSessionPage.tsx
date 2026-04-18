import { Navigate, useSearchParams } from 'react-router';

import {
  canAccessTableSessionEditor,
  canAccessTakeawayBuilder,
  getPosHomePath,
  usePosSession,
} from 'modules/auth';

import { TableSessionPageContent } from './TableSessionPage/TableSessionPageContent';

export function TableSessionPage() {
  const [searchParams] = useSearchParams();
  const { session } = usePosSession();
  const sessionId = searchParams.get('sessionId');
  const source = searchParams.get('source');

  if (!canAccessTableSessionEditor(session?.user, source)) {
    return <Navigate to={getPosHomePath(session)} replace />;
  }

  return <TableSessionPageContent sessionId={sessionId} mode="hall" source={source} />;
}

export function WaiterTakeawayPage() {
  const { session } = usePosSession();

  if (!canAccessTakeawayBuilder(session?.user)) {
    return <Navigate to={getPosHomePath(session)} replace />;
  }

  return <TableSessionPageContent sessionId={null} mode="takeaway" />;
}
