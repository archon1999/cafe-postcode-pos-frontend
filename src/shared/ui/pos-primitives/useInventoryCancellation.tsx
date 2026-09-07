import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
  Typography,
} from '@mui/material';
import { useState } from 'react';

import type { PosLocale } from 'shared/locale/copy';
import { inventoryCopy, type InventoryDisposition } from 'shared/pos/inventory';

type Item = { id: string; catalogItemName: string; inventoryConsumed?: boolean };

export function useInventoryCancellation(
  items: Item[] | undefined,
  remove: (itemId: string, disposition?: InventoryDisposition) => void,
  locale: PosLocale,
) {
  const [pending, setPending] = useState<Item | null>(null);
  const [disposition, setDisposition] = useState<InventoryDisposition>('waste');
  const copy = inventoryCopy[locale];
  const removeItem = (itemId: string) => {
    const item = items?.find((candidate) => candidate.id === itemId);
    if (!item?.inventoryConsumed) {
      remove(itemId);
      return;
    }
    setDisposition('waste');
    setPending(item);
  };
  const inventoryCancellationDialog = (
    <Dialog open={Boolean(pending)} onClose={() => setPending(null)} fullWidth maxWidth="sm">
      <DialogTitle>{copy.cancellation}</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Typography fontWeight={700}>{pending?.catalogItemName}</Typography>
          <Alert severity="info">{copy.note}</Alert>
          <RadioGroup
            value={disposition}
            onChange={(event) => setDisposition(event.target.value as InventoryDisposition)}>
            <FormControlLabel value="waste" control={<Radio />} label={copy.waste} />
            <FormControlLabel value="not_prepared" control={<Radio />} label={copy.notPrepared} />
            <FormControlLabel value="returned" control={<Radio />} label={copy.returned} />
          </RadioGroup>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setPending(null)}>{copy.close}</Button>
        <Button
          color="error"
          variant="contained"
          onClick={() => {
            if (pending) remove(pending.id, disposition);
            setPending(null);
          }}>
          {copy.confirm}
        </Button>
      </DialogActions>
    </Dialog>
  );
  return { removeItem, inventoryCancellationDialog };
}
