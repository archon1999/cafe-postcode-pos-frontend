import type { CashierContext } from '../entities';

export function isCashierFiscalIntegrationReady(context: CashierContext | undefined): boolean {
  const cashDesks = context?.availableCashDesks ?? [];
  const activeCashDeskId = context?.currentShift?.cashDesk;
  const activeCashDesk = cashDesks.find((cashDesk) => cashDesk.id === activeCashDeskId) ?? cashDesks[0];

  return Boolean(activeCashDesk?.fiscalProvider && context?.fiscalDeviceStatus?.online);
}
