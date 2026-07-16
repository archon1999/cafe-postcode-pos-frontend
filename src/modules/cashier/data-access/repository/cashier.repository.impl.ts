import type { CashierRepository } from 'modules/cashier/domain';

import { cashierOrderGateway } from './cashierOrderGateway';
import { cashierPaymentGateway } from './cashierPaymentGateway';
import { cashierQueryGateway } from './cashierQueryGateway';
import { cashierShiftGateway } from './cashierShiftGateway';

export const cashierRepository: CashierRepository = {
  ...cashierQueryGateway,
  ...cashierShiftGateway,
  ...cashierOrderGateway,
  ...cashierPaymentGateway,
};
