import { Icon } from '@iconify/react';
import {
  Box,
  Divider,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Menu,
  MenuItem,
  Typography,
  alpha,
} from '@mui/material';

import type { ActiveSession, DiningTable } from 'modules/waiter/domain';
import type { getPosCopy } from 'shared/locale/copy';

import type { TableOperationMode } from './TableOperationsDialog';

type Props = {
  anchorEl: HTMLElement | null;
  table: DiningTable | null;
  copy: ReturnType<typeof getPosCopy>;
  onClose: () => void;
  onAction: (mode: TableOperationMode, session: ActiveSession) => void;
};

function getSessions(table: DiningTable | null) {
  if (!table) return [];
  if (table.activeSessions?.length) return table.activeSessions;
  return table.activeSession ? [table.activeSession] : [];
}

export function TableActionsMenu({ anchorEl, table, copy, onClose, onAction }: Props) {
  const sessions = getSessions(table);
  const hasSeveralChecks = sessions.length > 1;

  const selectAction = (mode: TableOperationMode, session: ActiveSession) => {
    onClose();
    onAction(mode, session);
  };

  return (
    <Menu
      anchorEl={anchorEl}
      open={Boolean(anchorEl && table && sessions.length)}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      slotProps={{
        paper: {
          sx: (theme) => ({
            mt: 0.75,
            minWidth: 260,
            maxWidth: 320,
            borderRadius: '16px',
            backgroundColor: theme.palette.mode === 'dark' ? '#27292d' : '#fffdf8',
            border: `1px solid ${alpha('#ffffff', theme.palette.mode === 'dark' ? 0.05 : 0.28)}`,
            boxShadow:
              theme.palette.mode === 'dark' ? '0 18px 40px rgba(0,0,0,0.36)' : '0 18px 40px rgba(65,46,24,0.16)',
            overflow: 'hidden',
          }),
        },
      }}>
      <Box sx={{ px: 2, py: 1.25 }}>
        <Typography fontWeight={800}>{table?.name}</Typography>
        <Typography variant="caption" color="text.secondary">
          {copy.tableActions}
        </Typography>
      </Box>
      <Divider />

      {sessions.map((session, index) => {
        const isPrimaryTable = !session.primaryTableId || session.primaryTableId === table?.id;
        const canUngroup = (session.tableIds?.length ?? 1) > 1;
        return (
          <Box key={session.id}>
            {hasSeveralChecks ? (
              <ListSubheader disableSticky sx={{ lineHeight: '34px', backgroundColor: 'transparent', fontWeight: 800 }}>
                {copy.tableCheck} #{index + 1}
              </ListSubheader>
            ) : null}
            {isPrimaryTable ? (
              <>
                <MenuItem onClick={() => selectAction('transfer', session)} sx={{ minHeight: 48 }}>
                  <ListItemIcon>
                    <Icon icon="solar:transfer-horizontal-bold-duotone" width={22} />
                  </ListItemIcon>
                  <ListItemText primary={copy.moveTable} />
                </MenuItem>
                <MenuItem onClick={() => selectAction('group', session)} sx={{ minHeight: 48 }}>
                  <ListItemIcon>
                    <Icon icon="solar:widget-4-bold-duotone" width={22} />
                  </ListItemIcon>
                  <ListItemText primary={copy.groupTables} />
                </MenuItem>
              </>
            ) : null}
            {canUngroup ? (
              <MenuItem color="warning" onClick={() => selectAction('ungroup', session)} sx={{ minHeight: 48 }}>
                <ListItemIcon sx={{ color: 'warning.main' }}>
                  <Icon icon="solar:widget-2-bold-duotone" width={22} />
                </ListItemIcon>
                <ListItemText primary={copy.ungroupTables} slotProps={{ primary: { color: 'warning.main' } }} />
              </MenuItem>
            ) : null}
            {hasSeveralChecks && index < sessions.length - 1 ? <Divider /> : null}
          </Box>
        );
      })}
    </Menu>
  );
}
