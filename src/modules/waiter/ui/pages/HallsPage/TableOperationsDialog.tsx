import { Icon } from '@iconify/react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
  alpha,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';

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

  return (
    <Dialog open={open} onClose={pending ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {mode === 'transfer' ? copy.moveTable : mode === 'group' ? copy.groupTables : copy.ungroupTables}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2.25} sx={{ pt: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Chip icon={<Icon icon="solar:chair-2-bold-duotone" />} label={sourceTable?.name ?? ''} />
            <Typography color="text.secondary">
              {mode === 'transfer'
                ? copy.chooseTargetTable
                : mode === 'group'
                  ? copy.chooseGroupTables
                  : copy.ungroupTables}
            </Typography>
          </Stack>

          {mode === 'transfer' && halls.length > 1 ? (
            <FormControl fullWidth>
              <InputLabel>{copy.hall}</InputLabel>
              <Select
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

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(3, minmax(0, 1fr))' },
              gap: 1.25,
              maxHeight: 360,
              overflowY: 'auto',
              pr: 0.5,
            }}>
            {candidates.map((table) => {
              const selected = mode === 'transfer' ? table.id === targetTableId : groupTableIds.includes(table.id);
              const occupied = Boolean(table.activeSessions?.length);
              return (
                <Button
                  key={table.id}
                  variant={selected ? 'contained' : 'outlined'}
                  onClick={() => (mode === 'transfer' ? selectTransferTarget(table) : toggleGroupTable(table.id))}
                  sx={(theme) => ({
                    minHeight: 92,
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    textAlign: 'left',
                    px: 1.5,
                    py: 1.25,
                    borderRadius: 2.5,
                    backgroundImage: 'none',
                    ...(selected
                      ? {}
                      : {
                          backgroundColor: alpha(
                            theme.palette.background.paper,
                            theme.palette.mode === 'dark' ? 0.42 : 0.72,
                          ),
                        }),
                  })}>
                  <Stack spacing={0.5} alignItems="flex-start">
                    <Typography fontWeight={800}>{tableLabel(table)}</Typography>
                    <Typography variant="caption" sx={{ opacity: 0.78 }}>
                      {occupied ? copy.occupied : copy.available}
                    </Typography>
                  </Stack>
                  {mode !== 'transfer' ? <Checkbox checked={selected} tabIndex={-1} sx={{ p: 0 }} /> : null}
                </Button>
              );
            })}
          </Box>

          {mode === 'transfer' && selectedTarget ? (
            <Alert severity={selectedTargetSessions.length ? 'warning' : 'info'}>
              {selectedTargetSessions.length ? copy.targetTableOccupied : copy.targetTableEmpty}
            </Alert>
          ) : mode !== 'transfer' && groupTableIds.length ? (
            <Alert severity="info">{copy.groupTablesHint}</Alert>
          ) : null}

          {mode === 'transfer' && selectedTargetSessions.length > 1 ? (
            <Stack spacing={1}>
              {selectedTargetSessions.map((session, index) => (
                <Button
                  key={session.id}
                  variant={targetSessionId === session.id ? 'contained' : 'outlined'}
                  onClick={() => setTargetSessionId(session.id)}>
                  {copy.openTable} #{index + 1} · {session.guestCount} {copy.guests}
                </Button>
              ))}
            </Stack>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={pending}>
          {copy.close}
        </Button>
        <Button
          variant="contained"
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
      </DialogActions>
    </Dialog>
  );
}
