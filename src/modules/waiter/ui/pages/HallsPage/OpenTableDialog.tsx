import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material';

import type { DiningTable } from 'modules/waiter/domain';
import type { getPosCopy } from 'shared/locale/copy';

type Props = {
  table: DiningTable | null;
  guestCount: number;
  guestLimit: number;
  canManageTables: boolean;
  canReserveTables: boolean;
  opening: boolean;
  reserving: boolean;
  copy: ReturnType<typeof getPosCopy>;
  onGuestCountChange: (count: number) => void;
  onClose: () => void;
  onOpen: () => void;
  onReserve: () => void;
};

export function OpenTableDialog({
  table,
  guestCount,
  guestLimit,
  canManageTables,
  canReserveTables,
  opening,
  reserving,
  copy,
  onGuestCountChange,
  onClose,
  onOpen,
  onReserve,
}: Props) {
  return (
    <Dialog open={Boolean(table)} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{copy.openTable}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography variant="body1" color="text.secondary">
            {table?.name}
          </Typography>
          <TextField
            label={copy.guestCount}
            type="number"
            inputProps={{ min: 1, max: guestLimit }}
            value={guestCount}
            onChange={(event) =>
              onGuestCountChange(Math.max(1, Math.min(Math.trunc(Number(event.target.value)) || 1, guestLimit)))
            }
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button
          variant="contained"
          onClick={onClose}
          sx={(theme) => ({
            backgroundImage: 'none',
            backgroundColor: theme.palette.mode === 'dark' ? '#454545' : '#d6cebf',
            color: theme.palette.mode === 'dark' ? '#f5f5f5' : theme.palette.text.primary,
          })}>
          {copy.close}
        </Button>
        {canReserveTables && !table?.activeSession && table?.status !== 'reserved' ? (
          <Button
            variant="contained"
            onClick={onReserve}
            disabled={reserving || opening}
            sx={(theme) => ({
              backgroundImage: 'none',
              backgroundColor: theme.palette.mode === 'dark' ? '#7a6126' : '#d5a53d',
              color: '#ffffff',
            })}>
            {copy.reserveTable}
          </Button>
        ) : null}
        {table && guestLimit > 0 && (table.status === 'reserved' ? canReserveTables : canManageTables) ? (
          <Button variant="contained" onClick={onOpen} disabled={opening || reserving}>
            {copy.openTable}
          </Button>
        ) : null}
      </DialogActions>
    </Dialog>
  );
}
