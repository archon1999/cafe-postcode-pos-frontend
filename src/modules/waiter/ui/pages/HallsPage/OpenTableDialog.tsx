import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material';

import type { ActiveSession, DiningTable } from 'modules/waiter/domain';
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
  onOpenSession: (sessionId: string) => void;
  onTransferSession: (session: ActiveSession) => void;
  onGroupSession: (session: ActiveSession) => void;
  onUngroupSession: (session: ActiveSession) => void;
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
  onOpenSession,
  onTransferSession,
  onGroupSession,
  onUngroupSession,
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
          {table?.activeSessions?.length ? (
            <Stack spacing={1}>
              {table.activeSessions.map((activeSession, index) => (
                <Stack
                  key={activeSession.id}
                  spacing={1}
                  sx={(theme) => ({
                    p: 1.25,
                    borderRadius: 2.5,
                    border: `1px solid ${theme.palette.divider}`,
                  })}>
                  <Button variant="outlined" onClick={() => onOpenSession(activeSession.id)}>
                    {copy.openTable} #{index + 1}
                  </Button>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <Button size="small" onClick={() => onTransferSession(activeSession)}>
                      {copy.moveTable}
                    </Button>
                    <Button size="small" onClick={() => onGroupSession(activeSession)}>
                      {copy.groupTables}
                    </Button>
                    {(activeSession.tableIds?.length ?? 1) > 1 ? (
                      <Button size="small" color="warning" onClick={() => onUngroupSession(activeSession)}>
                        {copy.ungroupTables}
                      </Button>
                    ) : null}
                  </Stack>
                </Stack>
              ))}
            </Stack>
          ) : null}
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
