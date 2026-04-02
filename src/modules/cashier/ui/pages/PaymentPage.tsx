import { useSearchParams } from 'react-router';

import { PaymentPageContent } from './PaymentPage/PaymentPageContent';

export function PaymentPage() {
  const [searchParams] = useSearchParams();

  return <PaymentPageContent orderId={searchParams.get('orderId')} />;
}
