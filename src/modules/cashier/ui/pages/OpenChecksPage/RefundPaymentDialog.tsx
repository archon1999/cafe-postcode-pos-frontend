import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  Typography,
} from '@mui/material';
import { useState } from 'react';

import { useCashierRefundMutation } from 'modules/cashier/application';
import { type CashierOrder, getPaymentFailureState } from 'modules/cashier/domain';
import { requestEdgePrintDocuments } from 'modules/edge-printing/application';
import { getApiErrorMessage } from 'shared/api/errorMessage';
import { getPosCopy, type PosLocale } from 'shared/locale/copy';
import { formatCompactMoney } from 'shared/pos/utils';

type Payment = NonNullable<CashierOrder['payments']>[number];

export function RefundPaymentDialog({
  payment,
  payments,
  locale,
  onClose,
}: {
  payment: Payment;
  payments?: Payment[];
  locale: PosLocale;
  onClose: () => void;
}) {
  const copy = getPosCopy(locale);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const mutation = useCashierRefundMutation();
  const refundPayments = (payments ?? [payment]).filter((item) => item.status === 'succeeded' && !item.isRefunded);
  const wholeOrder = refundPayments.length > 1;
  const refundAmount = wholeOrder
    ? refundPayments.reduce((sum, item) => sum + Number(item.amount), 0)
    : Number(payment.amount);
  const needsExternalConfirmation = (wholeOrder ? refundPayments : [payment]).some(
    (item) => item.method !== 'cash' || Number(item.cardAmount ?? 0) > 0,
  );
  const unknown = error !== null && getPaymentFailureState(error).state === 'unknown';

  const submit = async () => {
    if (mutation.isPending || (needsExternalConfirmation && !confirmed)) return;
    try {
      const response = await mutation.mutateAsync({
        paymentId: payment.id,
        manualSettlementConfirmed: needsExternalConfirmation && confirmed,
        ...(wholeOrder ? { refundWholeOrder: true } : {}),
      });
      if (response.receipt?.printDocument) requestEdgePrintDocuments([response.receipt.printDocument]);
      onClose();
    } catch (failure) {
      setError(failure);
    }
  };

  return (
    <Dialog open onClose={mutation.isPending ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{copy.refund}</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Typography>{formatCompactMoney(refundAmount, locale)}</Typography>
          {wholeOrder ? <Typography>{copy.refundWholeOrderHint}</Typography> : null}
          <Typography>{needsExternalConfirmation ? copy.refundExternalHint : copy.refundCashHint}</Typography>
          {needsExternalConfirmation ? (
            <FormControlLabel
              control={
                <Checkbox
                  checked={confirmed}
                  disabled={mutation.isPending || unknown}
                  onChange={(event) => setConfirmed(event.target.checked)}
                />
              }
              label={copy.refundExternalConfirmed}
            />
          ) : null}
          {error !== null ? (
            <Alert severity={unknown ? 'warning' : 'error'}>
              {getApiErrorMessage(error, copy.financialResultUnknown)}
            </Alert>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={mutation.isPending}>
          {copy.cancel}
        </Button>
        <Button
          variant="contained"
          onClick={() => void submit()}
          disabled={mutation.isPending || (needsExternalConfirmation && !confirmed)}>
          {mutation.isPending ? copy.processing : unknown ? copy.checkFinancialResult : copy.refundConfirm}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
