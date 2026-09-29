import { Icon } from '@iconify/react';
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  IconButton,
  MenuItem,
  Select,
  Stack,
  Typography,
  alpha,
} from '@mui/material';
import { useEffect, useId, useMemo, useState } from 'react';

import type { ActiveSession, DiningTable, Hall } from 'modules/waiter/domain';
import type { getPosCopy } from 'shared/locale/copy';

export type TableOperationMode = 'transfer' | 'group' | 'ungroup';

export type TableOperationSubmit =
  | {
      mode: 'transfer';
      targetTable: DiningTable;
      targetSessionId?: string;
    }
  | {
      mode: 'group';
      tableIds: string[];
    }
  | {
      mode: 'ungroup';
      tableIds: string[];
    };

type Props = {
  open: boolean;
  mode: TableOperationMode;
  sourceTable: DiningTable | null;
  sourceSession: ActiveSession | null;
  halls: Hall[];
  copy: ReturnType<typeof getPosCopy>;
  pending: boolean;
  onClose: () => void;
  onConfirm: (operation: TableOperationSubmit) => void;
};

function tableLabel(table: DiningTable) {
  return `${table.tableNumber}. ${table.name}`;
}

export function TableOperationsDialog({
  open,
  mode,
  sourceTable,
  sourceSession,
  halls,
  copy,
  pending,
  onClose,
  onConfirm,
}: Props) {
  const titleId = useId();
  const instructionId = useId();
  const hallLabelId = useId();
  const sourceHall = halls.find((hall) => hall.tables.some((table) => table.id === sourceTable?.id));
  const [hallId, setHallId] = useState('');
  const [targetTableId, setTargetTableId] = useState('');
  const [targetSessionId, setTargetSessionId] = useState('');
  const [groupTableIds, setGroupTableIds] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setHallId(sourceHall?.id ?? halls[0]?.id ?? '');
    setTargetTableId('');
    setTargetSessionId('');
    setGroupTableIds(
      mode === 'ungroup'
        ? (sourceSession?.tableIds ?? []).filter((tableId) => tableId !== sourceSession?.primaryTableId)
        : [],
    );
  }, [halls, mode, open, sourceHall?.id, sourceSession?.primaryTableId, sourceSession?.tableIds]);

  const currentGroupIds = useMemo(
    () => new Set(sourceSession?.tableIds?.length ? sourceSession.tableIds : sourceTable ? [sourceTable.id] : []),
    [sourceSession?.tableIds, sourceTable],
  );
  const selectableHall = mode === 'transfer' ? halls.find((hall) => hall.id === hallId) : sourceHall;
  const candidates = (selectableHall?.tables ?? []).filter((table) =>
    mode === 'ungroup'
      ? currentGroupIds.has(table.id) && table.id !== sourceSession?.primaryTableId
      : !currentGroupIds.has(table.id) && table.status !== 'blocked' && table.status !== 'reserved',
  );
  const selectedTarget = candidates.find((table) => table.id === targetTableId);
  const selectedTargetSessions = selectedTarget?.activeSessions ?? [];

  const selectTransferTarget = (table: DiningTable) => {
    setTargetTableId(table.id);
    setTargetSessionId(table.activeSessions?.[0]?.id ?? '');
  };

  const toggleGroupTable = (tableId: string) => {
    setGroupTableIds((current) =>
      current.includes(tableId) ? current.filter((value) => value !== tableId) : [...current, tableId],
    );
  };

  const canConfirm =
    mode === 'transfer'
      ? Boolean(selectedTarget && (!selectedTargetSessions.length || targetSessionId))
      : groupTableIds.length > 0;
  const selectedTables = candidates.filter((table) =>
    mode === 'transfer' ? table.id === targetTableId : groupTableIds.includes(table.id),
  );
  const instruction =
    mode === 'transfer' ? copy.chooseTargetTable : mode === 'group' ? copy.chooseGroupTables : copy.chooseUngroupTables;

  return (
    <Dialog
      open={open}
      onClose={pending ? undefined : onClose}
      aria-labelledby={titleId}
      aria-describedby={instructionId}
      maxWidth="sm"
      fullWidth
      slotProps={{ paper: { sx: { m: { xs: 1.5, sm: 4 }, width: { xs: 'calc(100% - 24px)', sm: '100%' } } } }}>
      <DialogTitle id={titleId} sx={{ px: { xs: 2, sm: 3 }, pt: 2.5, pb: 2, pr: 7 }}>
        {mode === 'transfer' ? copy.moveTable : mode === 'group' ? copy.groupTables : copy.ungroupTables}
      </DialogTitle>
      <IconButton
        aria-label={copy.close}
        onClick={onClose}
        disabled={pending}
        sx={{ position: 'absolute', top: 12, right: 12, width: 44, height: 44 }}>
        <Icon icon="solar:close-circle-linear" width={24} />
      </IconButton>
      <DialogContent sx={{ px: { xs: 2, sm: 3 }, pb: 2.5 }}>
        <Stack spacing={2.5}>
          <Stack
            direction="row"
            spacing={1.25}
            alignItems="center"
            sx={{ p: 1.5, borderRadius: 2, bgcolor: 'action.hover' }}>
            <Box sx={{ display: 'flex', color: 'text.secondary' }}>
              <Icon icon="solar:chair-2-bold-duotone" width={28} />
            </Box>
            <Stack sx={{ minWidth: 0 }}>
              <Typography variant="caption" color="text.secondary">
                {copy.currentTable}
              </Typography>
              <Typography fontWeight={700} sx={{ overflowWrap: 'anywhere' }}>
                {sourceTable ? tableLabel(sourceTable) : ''}
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto !important', textAlign: 'right' }}>
              {sourceHall?.name}
            </Typography>
          </Stack>

          {mode === 'transfer' && halls.length > 1 ? (
            <FormControl fullWidth disabled={pending}>
              <InputLabel id={hallLabelId}>{copy.hall}</InputLabel>
              <Select
                labelId={hallLabelId}
                label={copy.hall}
                value={hallId}
                onChange={(event) => {
                  setHallId(event.target.value);
                  setTargetTableId('');
                  setTargetSessionId('');
                }}>
                {halls.map((hall) => (
                  <MenuItem key={hall.id} value={hall.id}>
                    {hall.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          ) : null}

          <Typography id={instructionId} variant="subtitle2" fontWeight={700}>
            {instruction}
          </Typography>
          {!candidates.length ? <Alert severity="info">{copy.noSelectableTables}</Alert> : null}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(3, minmax(0, 1fr))' },
              gap: 1.25,
              p: 0.5,
              m: -0.5,
            }}>
            {candidates.map((table) => {
              const selected = mode === 'transfer' ? table.id === targetTableId : groupTableIds.includes(table.id);
              const occupied = Boolean(table.activeSessions?.length);
              return (
                <ButtonBase
                  key={table.id}
                  aria-pressed={selected}
                  disabled={pending}
                  onClick={() => (mode === 'transfer' ? selectTransferTarget(table) : toggleGroupTable(table.id))}
                  sx={(theme) => ({
                    minHeight: 112,
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    textAlign: 'left',
                    gap: 1,
                    p: 1.5,
                    borderRadius: 2,
                    border: '2px solid',
                    borderColor: selected ? 'primary.main' : 'divider',
                    color: 'text.primary',
                    bgcolor: selected ? alpha(theme.palette.primary.main, 0.12) : 'background.paper',
                    transition: theme.transitions.create(['background-color', 'border-color']),
                    '&:hover': {
                      borderColor: 'primary.main',
                      bgcolor: alpha(theme.palette.primary.main, selected ? 0.18 : 0.06),
                    },
                    '&.Mui-focusVisible': { outline: `3px solid ${theme.palette.primary.main}`, outlineOffset: 2 },
                    '&.Mui-disabled': { opacity: 0.65 },
                  })}>
                  <Stack spacing={1.25} alignItems="flex-start" sx={{ minWidth: 0 }}>
                    <Typography fontWeight={800} sx={{ overflowWrap: 'anywhere' }}>
                      {tableLabel(table)}
                    </Typography>
                    <Stack direction="row" spacing={0.75} alignItems="center">
                      <Box
                        component="span"
                        sx={{
                          width: 7,
                          height: 7,
                          flexShrink: 0,
                          borderRadius: '50%',
                          bgcolor: occupied ? 'warning.main' : 'success.main',
                        }}
                      />
                      <Typography variant="caption" color="text.secondary">
                        {occupied ? copy.occupied : copy.available}
                      </Typography>
                    </Stack>
                  </Stack>
                  <Box
                    component="span"
                    aria-hidden="true"
                    sx={{
                      display: 'grid',
                      placeItems: 'center',
                      width: 22,
                      height: 22,
                      flexShrink: 0,
                      borderRadius: mode === 'transfer' ? '50%' : 0.75,
                      border: '2px solid',
                      borderColor: selected ? 'primary.main' : 'text.disabled',
                      bgcolor: selected ? 'primary.main' : 'transparent',
                      color: 'primary.contrastText',
                      fontSize: 16,
                      fontWeight: 800,
                    }}>
                    {selected ? '\u2713' : null}
                  </Box>
                </ButtonBase>
              );
            })}
          </Box>

          {mode === 'transfer' && selectedTarget ? (
            <Alert severity={selectedTargetSessions.length ? 'warning' : 'info'}>
              {selectedTargetSessions.length ? copy.targetTableOccupied : copy.targetTableEmpty}
            </Alert>
          ) : mode !== 'transfer' && groupTableIds.length ? (
            <Alert severity="info">{mode === 'group' ? copy.groupTablesHint : copy.ungroupTablesHint}</Alert>
          ) : null}

          {mode === 'transfer' && selectedTargetSessions.length > 1 ? (
            <Stack spacing={1}>
              <Typography variant="subtitle2">{copy.chooseTargetSession}</Typography>
              {selectedTargetSessions.map((session, index) => (
                <Button
                  key={session.id}
                  variant={targetSessionId === session.id ? 'contained' : 'outlined'}
                  aria-pressed={targetSessionId === session.id}
                  disabled={pending}
                  onClick={() => setTargetSessionId(session.id)}>
                  {copy.tableCheck} #{index + 1} · {session.guestCount} {copy.guests}
                </Button>
              ))}
            </Stack>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions
        sx={{
          flexDirection: 'column',
          alignItems: 'stretch',
          gap: 2,
          p: { xs: 2, sm: 3 },
          borderTop: 1,
          borderColor: 'divider',
          '& > :not(style) ~ :not(style)': { ml: 0 },
        }}>
        <Stack spacing={1} aria-live="polite">
          <Typography variant="caption" color="text.secondary">
            {selectedTables.length ? `${copy.selectedTables}: ${selectedTables.length}` : instruction}
          </Typography>
          {selectedTables.length ? (
            <Stack direction="row" gap={0.75} flexWrap="wrap" sx={{ maxHeight: 80, overflowY: 'auto' }}>
              {selectedTables.map((table) => (
                <Chip key={table.id} size="small" label={tableLabel(table)} sx={{ maxWidth: '100%' }} />
              ))}
            </Stack>
          ) : null}
        </Stack>
        <Stack direction={{ xs: 'column-reverse', sm: 'row' }} spacing={1} justifyContent="flex-end">
          <Button variant="outlined" color="inherit" onClick={onClose} disabled={pending}>
            {copy.cancel}
          </Button>
          <Button
            variant="contained"
            loading={pending}
            disabled={!canConfirm || pending}
            onClick={() => {
              if (mode === 'transfer' && selectedTarget) {
                onConfirm({ mode, targetTable: selectedTarget, targetSessionId: targetSessionId || undefined });
              } else if (mode !== 'transfer' && groupTableIds.length) {
                onConfirm({ mode, tableIds: groupTableIds });
              }
            }}>
            {mode === 'transfer'
              ? copy.confirmMoveTable
              : mode === 'group'
                ? copy.confirmGroupTables
                : copy.confirmUngroupTables}
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}
