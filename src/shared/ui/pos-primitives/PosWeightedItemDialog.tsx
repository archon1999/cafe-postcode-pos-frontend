import { Icon } from '@iconify/react';
import { Box, Button, Dialog, DialogContent, IconButton, Stack, TextField, Typography, alpha } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';

import type { SaleUnit } from 'shared/domain/sale-units';
import { getSaleUnit, isValidSaleQuantity, saleUnitLabel } from 'shared/domain/sale-units';
import { getPosCopy, type PosLocale } from 'shared/locale/copy';
import { modifierPriceDelta, type PosModifierGroup, type PosModifierSelection } from 'shared/pos/modifiers';
import { formatCompactMoney } from 'shared/pos/utils';

import { PosItemNoteField } from './PosItemNoteField';

type WeightedMenuItem = {
  id: string;
  name: string;
  price: number | string;
  saleUnit?: SaleUnit;
  modifierGroups?: PosModifierGroup[];
};

type Props = {
  item: WeightedMenuItem;
  selections: PosModifierSelection[];
  locale: PosLocale;
  showPrice?: boolean;
  allowItemNote?: boolean;
  initialNote?: string;
  onClose: () => void;
  onConfirm: (quantity: number, note: string) => void;
};

function parseQuantity(value: string, unit: SaleUnit) {
  const normalized = value.trim().replace(',', '.');
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return null;
  const quantity = Number(normalized);
  return isValidSaleQuantity(quantity, unit, getSaleUnit(unit).allowZero) ? quantity : null;
}

export function PosWeightedItemDialog({
  allowItemNote = false,
  initialNote,
  item,
  selections,
  locale,
  showPrice = true,
  onClose,
  onConfirm,
}: Props) {
  const copy = getPosCopy(locale);
  const [value, setValue] = useState('1');
  const [note, setNote] = useState('');
  const saleUnit = item.saleUnit ?? 'kg';
  const rule = getSaleUnit(saleUnit);
  const quantity = useMemo(() => parseQuantity(value, saleUnit), [value, saleUnit]);
  const unitPrice = Number(item.price || 0) + modifierPriceDelta(item.modifierGroups ?? [], selections);

  useEffect(() => {
    setValue('1');
    setNote(initialNote ?? '');
  }, [initialNote, item.id, selections]);

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogContent sx={{ p: { xs: 2, sm: 2.5 } }}>
        <Stack spacing={2.2}>
          <Stack direction="row" alignItems="flex-start" spacing={2}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="h5" fontWeight={850}>
                {item.name}
              </Typography>
              {showPrice ? (
                <Typography color="text.secondary">
                  {copy[rule.posPriceKey]}: {formatCompactMoney(unitPrice, locale)}
                </Typography>
              ) : null}
            </Box>
            <IconButton
              aria-label={copy.close}
              onClick={onClose}
              sx={(theme) => ({ bgcolor: alpha(theme.palette.text.primary, 0.06) })}>
              <Icon icon="solar:close-circle-bold" width={24} />
            </IconButton>
          </Stack>

          <TextField
            autoFocus
            label={`${copy.weightLabel} (${saleUnitLabel(saleUnit, locale)})`}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            error={value.length > 0 && quantity === null}
            helperText={quantity === null ? copy[rule.posInvalidKey] : copy[rule.posTitleKey]}
            slotProps={{ htmlInput: { inputMode: 'decimal', min: 0, step: rule.step } }}
            fullWidth
          />

          {allowItemNote ? <PosItemNoteField locale={locale} onChange={setNote} value={note} /> : null}

          {showPrice ? (
            <Box
              sx={(theme) => ({
                borderRadius: '12px',
                bgcolor: alpha(theme.palette.primary.main, 0.07),
                p: 1.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 2,
              })}>
              <Typography color="text.secondary">{copy.total}</Typography>
              <Typography variant="h5" fontWeight={900}>
                {formatCompactMoney((quantity ?? 0) * unitPrice, locale)}
              </Typography>
            </Box>
          ) : null}

          <Button
            variant="contained"
            size="large"
            disabled={quantity === null}
            onClick={() => {
              if (quantity === 0) onClose();
              else if (quantity !== null) onConfirm(quantity, note.trim());
            }}
            sx={{ minHeight: 52 }}>
            {copy.addWeightedItem}
          </Button>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
