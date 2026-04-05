import { CssBaseline, ThemeProvider } from '@mui/material';
import { QueryClientProvider } from '@tanstack/react-query';
import { useMemo } from 'react';
import { RouterProvider } from 'react-router';
import { Toaster } from 'sonner';

import { PosSessionProvider, usePosSession } from 'modules/auth';

import { queryClient } from '../shared/api/query-client';
import { registerServiceWorker } from '../shared/pwa/register-service-worker';

import { posRouter } from './router';
import { createPosTheme } from './theme';

registerServiceWorker();

function PosApplication() {
  const { themeMode } = usePosSession();
  const theme = useMemo(() => createPosTheme(themeMode), [themeMode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <QueryClientProvider client={queryClient}>
        <Toaster richColors position="top-center" />
        <RouterProvider router={posRouter} />
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default function App() {
  return (
    <PosSessionProvider>
      <PosApplication />
    </PosSessionProvider>
  );
}
