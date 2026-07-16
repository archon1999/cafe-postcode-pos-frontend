import { Box, Snackbar, Stack, Typography } from '@mui/material';
import type { MouseEvent } from 'react';

import { getPosCopy } from 'shared/locale/copy';
import { PosIconAction } from 'shared/ui/pos-primitives';

type PaymentPageHeaderProps = {
  copy: ReturnType<typeof getPosCopy>;
  isMobile: boolean;
  onBack: () => void;
  onLock: () => void;
  onRefresh: () => void;
  onSettings: (event: MouseEvent<HTMLElement>) => void;
};

export function PaymentPageHeader({ copy, isMobile, onBack, onLock, onRefresh, onSettings }: PaymentPageHeaderProps) {
  return (
    <Stack
      direction="row"
      spacing={{ xs: 1, md: 1.5 }}
      justifyContent="space-between"
      alignItems={{ xs: 'stretch', md: 'center' }}>
      <Stack direction="row" spacing={{ xs: 1, md: 1.5 }}>
        <PosIconAction icon="solar:alt-arrow-left-bold" onClick={onBack} />
        <Typography variant="h4" sx={{ alignSelf: 'center' }}>
          {copy.pay}
        </Typography>
      </Stack>
      <Stack direction="row" spacing={{ xs: 1, md: 1.5 }} sx={{ justifyContent: { xs: 'flex-end', md: 'flex-start' } }}>
        {!isMobile ? <PosIconAction icon="solar:refresh-bold-duotone" onClick={onRefresh} /> : null}
        <PosIconAction icon="solar:settings-bold-duotone" onClick={onSettings} />
        {!isMobile ? <PosIconAction icon="solar:lock-password-bold-duotone" onClick={onLock} /> : null}
      </Stack>
    </Stack>
  );
}

type PaymentPageToastsProps = {
  copy: ReturnType<typeof getPosCopy>;
  errorMessage: string;
  errorOpen: boolean;
  printOpen: boolean;
  onErrorClose: () => void;
  onPrintClose: () => void;
};

export function PaymentPageToasts({
  copy,
  errorMessage,
  errorOpen,
  printOpen,
  onErrorClose,
  onPrintClose,
}: PaymentPageToastsProps) {
  return (
    <>
      <Snackbar
        open={errorOpen}
        autoHideDuration={2600}
        onClose={onErrorClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Box
          sx={(theme) => ({
            px: 2,
            py: 1.2,
            borderRadius: '12px',
            backgroundColor: theme.palette.mode === 'dark' ? '#4c2529' : '#f6dadd',
            color: theme.palette.mode === 'dark' ? '#ffe9eb' : '#8a1f2d',
            fontWeight: 700,
            boxShadow: '0 12px 28px rgba(0, 0, 0, 0.22)',
          })}>
          {errorMessage || copy.paymentFailed}
        </Box>
      </Snackbar>
      <Snackbar
        open={printOpen}
        autoHideDuration={2200}
        onClose={onPrintClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Box
          sx={(theme) => ({
            px: 2,
            py: 1.2,
            borderRadius: '12px',
            backgroundColor: theme.palette.mode === 'dark' ? '#1f4a46' : '#d8efea',
            color: theme.palette.mode === 'dark' ? '#d7fbf7' : '#155b54',
            fontWeight: 700,
            boxShadow: '0 12px 28px rgba(0, 0, 0, 0.22)',
          })}>
          {copy.receiptPrinted}
        </Box>
      </Snackbar>
    </>
  );
}
