import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';

import type { CashShiftSummary } from 'modules/cashier/domain';
import { getPosCopy, type PosLocale } from 'shared/locale/copy';
import { PosIconAction } from 'shared/ui/pos-primitives';

import { CashierShiftTotals } from './CashierShiftControls';

type ManagerShiftPanelProps = {
  activeShifts: CashShiftSummary[];
  availableCashDeskCount: number;
  canOpenShift: boolean;
  isMobile: boolean;
  locale: PosLocale;
  openShiftDialogOpen: boolean;
  opening: boolean;
  openShiftFields: ReactNode;
  onOpenDialogChange: (open: boolean) => void;
  onOpenShift: () => void;
  renderShift: (shift: CashShiftSummary) => ReactNode;
};

export function ManagerShiftPanel({
  activeShifts,
  availableCashDeskCount,
  canOpenShift,
  isMobile,
  locale,
  openShiftDialogOpen,
  opening,
  openShiftFields,
  onOpenDialogChange,
  onOpenShift,
  renderShift,
}: ManagerShiftPanelProps) {
  const copy = getPosCopy(locale);
  const renderOpenButton = (size?: 'large' | 'medium') => (
    <Button variant="contained" size={size} disabled={!canOpenShift} onClick={onOpenShift}>
      {opening ? copy.processing : copy.openShift}
    </Button>
  );

  return (
    <Stack spacing={2.2}>
      {activeShifts.length ? (
        <Stack spacing={1.5}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.25}
            justifyContent="space-between"
            alignItems={{ xs: 'stretch', sm: 'center' }}>
            <Typography variant="h5">{copy.activeShifts}</Typography>
            {availableCashDeskCount ? (
              <Button variant="outlined" onClick={() => onOpenDialogChange(true)}>
                {copy.openAnotherShift}
              </Button>
            ) : null}
          </Stack>
          {activeShifts.map(renderShift)}
        </Stack>
      ) : (
        <Stack spacing={2}>
          <Box>
            <Typography variant="h5">{copy.openShift}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
              {copy.openShiftDescription}
            </Typography>
          </Box>
          {openShiftFields}
          {renderOpenButton(isMobile ? 'large' : 'medium')}
        </Stack>
      )}

      {activeShifts.length && !availableCashDeskCount ? (
        <Typography variant="body2" color="text.secondary">
          {copy.allCashDesksOpen}
        </Typography>
      ) : null}
      {activeShifts.length ? (
        <Dialog
          open={openShiftDialogOpen}
          onClose={() => onOpenDialogChange(false)}
          fullWidth
          maxWidth="sm"
          fullScreen={isMobile}>
          <DialogTitle>
            <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
              <Box>
                <Typography variant="h5">{copy.openShift}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                  {copy.openShiftDescription}
                </Typography>
              </Box>
              <PosIconAction icon="solar:close-circle-bold" onClick={() => onOpenDialogChange(false)} />
            </Stack>
          </DialogTitle>
          <DialogContent dividers>{openShiftFields}</DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={() => onOpenDialogChange(false)}>{copy.cancel}</Button>
            {renderOpenButton()}
          </DialogActions>
        </Dialog>
      ) : null}
    </Stack>
  );
}

type EmployeeShiftPanelProps = {
  currentShift: CashShiftSummary;
  locale: PosLocale;
  onContinue: () => void;
};

export function EmployeeShiftPanel({ currentShift, locale, onContinue }: EmployeeShiftPanelProps) {
  const copy = getPosCopy(locale);
  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="h5">{copy.currentShift}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
          {currentShift.cashDeskName}
        </Typography>
      </Box>
      <CashierShiftTotals locale={locale} shift={currentShift} />
      <ContinueShiftButton onClick={onContinue}>{copy.continueWork}</ContinueShiftButton>
    </Stack>
  );
}

export function WaitingShiftPanel({ locale, onContinue }: Omit<EmployeeShiftPanelProps, 'currentShift'>) {
  const copy = getPosCopy(locale);
  return (
    <Stack spacing={2}>
      <Typography variant="h5">{copy.shift}</Typography>
      <Typography variant="body2" color="text.secondary">
        {copy.shiftWaitingManager}
      </Typography>
      <ContinueShiftButton onClick={onContinue}>{copy.continueWork}</ContinueShiftButton>
    </Stack>
  );
}

function ContinueShiftButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <Button
      variant="contained"
      sx={(theme) => ({
        backgroundImage: 'none',
        backgroundColor: 'var(--pos-secondary-action-bg)',
        color: theme.palette.mode === 'dark' ? '#f5f5f5' : theme.palette.text.primary,
      })}
      onClick={onClick}>
      {children}
    </Button>
  );
}
