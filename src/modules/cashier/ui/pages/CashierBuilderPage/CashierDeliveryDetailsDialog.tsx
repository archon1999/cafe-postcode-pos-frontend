import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField } from '@mui/material';

import { formatDeliveryPhoneInput } from 'modules/cashier/domain';
import type { getPosCopy } from 'shared/locale/copy';

export type PendingDeliveryAction = 'submit' | 'checkout';

type Props = {
  open: boolean;
  saving: boolean;
  attempted: boolean;
  phone: string;
  address: string;
  isPhoneValid: boolean;
  isAddressValid: boolean;
  pendingAction: PendingDeliveryAction | null;
  copy: ReturnType<typeof getPosCopy>;
  onPhoneChange: (value: string) => void;
  onAddressChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
};

export function CashierDeliveryDetailsDialog({
  open,
  saving,
  attempted,
  phone,
  address,
  isPhoneValid,
  isAddressValid,
  pendingAction,
  copy,
  onPhoneChange,
  onAddressChange,
  onClose,
  onConfirm,
}: Props) {
  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>{copy.deliveryDetails}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <TextField
            label={copy.deliveryPhone}
            value={phone}
            onChange={(event) => onPhoneChange(formatDeliveryPhoneInput(event.target.value))}
            inputProps={{ inputMode: 'numeric' }}
            error={attempted && !isPhoneValid}
            helperText={copy.deliveryPhoneHelper}
            autoFocus
          />
          <TextField
            label={copy.deliveryAddress}
            value={address}
            onChange={(event) => onAddressChange(event.target.value)}
            multiline
            minRows={3}
            error={attempted && !isAddressValid}
            helperText={attempted && !isAddressValid ? copy.deliveryAddressRequired : ' '}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>
          {copy.close}
        </Button>
        <Button variant="contained" onClick={onConfirm} disabled={saving}>
          {saving ? copy.processing : pendingAction === 'checkout' ? copy.goToPayment : copy.sendOrder}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
