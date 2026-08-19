import { Icon } from '@iconify/react';
import { Button, Dialog, DialogContent, IconButton, Stack, TextField, Typography, alpha } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';

import { getPosCopy, type PosLocale } from 'shared/locale/copy';
import { formatCompactMoney } from 'shared/pos/utils';

type ServiceMenuItem = {
  id: string;
  name: string;
};

type Props = {
  item: ServiceMenuItem;
  locale: PosLocale;
  onClose: () => void;
  onConfirm: (price: number) => void;
};

export function parseServicePrice(value: string) {
  const normalized = value.trim().replace(/\s/g, '');
  if (!/^\d+$/.test(normalized)) return null;
  const price = Number(normalized);
  return Number.isSafeInteger(price) && price > 0 && price <= 2_147_483_647 ? price : null;
}

export function PosServicePriceDialog({ item, locale, onClose, onConfirm }: Props) {
  const copy = getPosCopy(locale);
  const [value, setValue] = useState('');
  const price = useMemo(() => parseServicePrice(value), [value]);

  useEffect(() => setValue(''), [item.id]);

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogContent sx={{ p: { xs: 2, sm: 2.5 } }}>
        <Stack spacing={2.2}>
          <Stack direction="row" alignItems="flex-start" spacing={2}>
            <Stack sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="h5" fontWeight={850}>
                {item.name}
              </Typography>
              <Typography color="text.secondary">{copy.servicePriceTitle}</Typography>
            </Stack>
            <IconButton
              aria-label={copy.close}
              onClick={onClose}
              sx={(theme) => ({ bgcolor: alpha(theme.palette.text.primary, 0.06) })}>
              <Icon icon="solar:close-circle-bold" width={24} />
            </IconButton>
          </Stack>

          <TextField
            autoFocus
            label={copy.servicePriceLabel}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            error={value.length > 0 && price === null}
            helperText={value.length > 0 && price === null ? copy.servicePriceInvalid : ' '}
            slotProps={{ htmlInput: { inputMode: 'numeric' } }}
            fullWidth
          />

          {price !== null ? (
            <Typography variant="h5" fontWeight={900} textAlign="right">
              {formatCompactMoney(price, locale)}
            </Typography>
          ) : null}

          <Button
            variant="contained"
            size="large"
            disabled={price === null}
            onClick={() => price !== null && onConfirm(price)}
            sx={{ minHeight: 52 }}>
            {copy.addService}
          </Button>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
