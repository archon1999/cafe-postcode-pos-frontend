/* eslint-disable i18next/no-literal-string */
import { Box, Button, CircularProgress, Stack, Typography, alpha } from '@mui/material';
import axios from 'axios';
import QRCode from 'qrcode';
import { useCallback, useEffect, useRef, useState } from 'react';

import { kitchenRepository, persistTvMonitorDevice, readTvMonitorDevice } from 'modules/kitchen/data-access';
import type {
  KitchenMonitorQueue,
  TvMonitorDeviceRegistration,
  TvMonitorDiagnosticEvent,
  TvMonitorPairingSession,
} from 'modules/kitchen/domain';

import { KitchenMonitorDisplay } from './KitchenMonitorPage';
import {
  TvMonitorDiagnostics,
  TvMonitorRenderBoundary,
  type TvMonitorDiagnosticSnapshot,
} from './TvMonitorDiagnostics';

const PAIRING_POLL_INTERVAL_MS = 2000;
const QUEUE_POLL_INTERVAL_MS = 5000;
const DIAGNOSTIC_HEARTBEAT_INTERVAL_MS = 60_000;
const EMPTY_QUEUE: KitchenMonitorQueue = {
  monitorVariant: 'default',
  preparing: [],
  recentlyDone: [],
  announcements: [],
};
const INITIAL_DIAGNOSTICS: TvMonitorDiagnosticSnapshot = {
  stage: 'pairing',
  lastSuccessAt: null,
  preparingCount: 0,
  readyCount: 0,
  lastError: '',
  renderError: '',
};

function requiresPairing(error: unknown) {
  return (
    axios.isAxiosError(error) && error.response?.status === 401 && error.response.data?.code === 'tv_pairing_required'
  );
}

function describeTvMonitorError(error: unknown) {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status ? `HTTP ${error.response.status}` : 'NETWORK';
    const detail = error.response?.data?.detail || error.message;
    return `${status}: ${String(detail)}`.slice(0, 1000);
  }
  return error instanceof Error ? error.message.slice(0, 1000) : String(error).slice(0, 1000);
}

export function TvMonitorPage() {
  const [device, setDevice] = useState<TvMonitorDeviceRegistration | null>(() => readTvMonitorDevice());
  const [pairing, setPairing] = useState<TvMonitorPairingSession | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [monitorData, setMonitorData] = useState<KitchenMonitorQueue>(EMPTY_QUEUE);
  const [pairingError, setPairingError] = useState('');
  const [diagnostics, setDiagnostics] = useState<TvMonitorDiagnosticSnapshot>(INITIAL_DIAGNOSTICS);
  const pairingRequestRef = useRef<Promise<TvMonitorPairingSession> | null>(null);
  const lastQueueDiagnosticRef = useRef({ signature: '', reportedAt: 0 });

  const reportDiagnostic = useCallback(
    (event: TvMonitorDiagnosticEvent, message = '', context: Record<string, unknown> = {}) => {
      if (!device) return;
      void kitchenRepository
        .reportTvMonitorDiagnostic(device.token, {
          event,
          message,
          clientTime: new Date().toISOString(),
          context: {
            ...context,
            restaurantId: device.restaurantId,
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
            online: navigator.onLine,
            visibilityState: document.visibilityState,
            nativeBridge: Boolean(window.CafePostcodeTv),
          },
        })
        .catch(() => undefined);
    },
    [device],
  );

  const forgetDevice = useCallback(() => {
    persistTvMonitorDevice(null);
    setDevice(null);
    setPairing(null);
    setMonitorData(EMPTY_QUEUE);
    setDiagnostics(INITIAL_DIAGNOSTICS);
  }, []);

  const createPairing = useCallback(async () => {
    setPairingError('');
    setQrDataUrl('');
    const request = pairingRequestRef.current ?? kitchenRepository.createTvMonitorPairing();
    pairingRequestRef.current = request;

    try {
      const nextPairing = await request;
      setPairing(nextPairing);
      const claimUrl = new URL(`/tv/pair/${nextPairing.id}`, window.location.origin);
      claimUrl.searchParams.set('token', nextPairing.claimToken);
      setQrDataUrl(await QRCode.toDataURL(claimUrl.toString(), { width: 560, margin: 2, errorCorrectionLevel: 'M' }));
    } catch {
      setPairingError('QR yaratib bo‘lmadi. Internet aloqasini tekshiring.');
    } finally {
      pairingRequestRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!device && !pairing && !pairingRequestRef.current) void createPairing();
  }, [createPairing, device, pairing]);

  useEffect(() => {
    if (device || !pairing) return;

    let active = true;
    const checkPairing = async () => {
      try {
        const status = await kitchenRepository.getTvMonitorPairingStatus(pairing.id, pairing.pollToken);
        if (!active || status.status !== 'paired') return;

        const registration: TvMonitorDeviceRegistration = {
          token: pairing.pollToken,
          restaurantId: status.restaurantContext.restaurantId,
          restaurantName: status.restaurantContext.restaurantName,
          posMonitorVariant: status.restaurantContext.posMonitorVariant,
        };
        persistTvMonitorDevice(registration);
        setDevice(registration);
      } catch (error) {
        if (!active) return;
        if (axios.isAxiosError(error) && error.response?.status === 410) {
          setPairing(null);
        }
      }
    };

    void checkPairing();
    const intervalId = window.setInterval(() => void checkPairing(), PAIRING_POLL_INTERVAL_MS);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [device, pairing]);

  useEffect(() => {
    if (!device) return;

    setDiagnostics((current) => ({ ...current, stage: 'loading', lastError: '' }));
    reportDiagnostic('page_loaded', 'TV monitor page loaded', {
      userAgent: navigator.userAgent,
      language: navigator.language,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
    });
  }, [device, reportDiagnostic]);

  useEffect(() => {
    if (!device) return;

    const handleWindowError = (event: ErrorEvent) => {
      const message = `${event.message || 'Unknown window error'}${event.filename ? ` @ ${event.filename}:${event.lineno}` : ''}`;
      setDiagnostics((current) => ({ ...current, stage: 'error', renderError: message }));
      reportDiagnostic('window_error', message, { stack: event.error instanceof Error ? event.error.stack : '' });
    };
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const message = describeTvMonitorError(event.reason);
      setDiagnostics((current) => ({ ...current, stage: 'error', renderError: message }));
      reportDiagnostic('unhandled_rejection', message);
    };

    window.addEventListener('error', handleWindowError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    return () => {
      window.removeEventListener('error', handleWindowError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [device, reportDiagnostic]);

  useEffect(() => {
    if (!device) return;

    let active = true;
    const fetchQueue = async () => {
      setDiagnostics((current) => ({ ...current, stage: current.lastSuccessAt ? current.stage : 'loading' }));
      try {
        const queue = await kitchenRepository.getTvMonitorQueue(device.token);
        if (active) {
          const succeededAt = new Date().toISOString();
          setMonitorData(queue);
          setDiagnostics((current) => ({
            ...current,
            stage: 'online',
            lastSuccessAt: succeededAt,
            preparingCount: queue.preparing.length,
            readyCount: queue.recentlyDone.length,
            lastError: '',
          }));
          window.CafePostcodeTv?.onQueueSuccess?.();

          const now = Date.now();
          const signature = `${queue.preparing.length}:${queue.recentlyDone.length}`;
          const shouldReport =
            lastQueueDiagnosticRef.current.signature !== signature ||
            now - lastQueueDiagnosticRef.current.reportedAt >= DIAGNOSTIC_HEARTBEAT_INTERVAL_MS;
          if (shouldReport) {
            lastQueueDiagnosticRef.current = { signature, reportedAt: now };
            window.setTimeout(() => {
              reportDiagnostic('queue_success', 'Queue response applied', {
                preparingCount: queue.preparing.length,
                readyCount: queue.recentlyDone.length,
                renderedTicketCount: document.querySelectorAll('[data-monitor-ticket-id]').length,
                monitorCanvasPresent: Boolean(document.querySelector('[data-testid="monitor-canvas"]')),
              });
            }, 0);
          }
        }
      } catch (error) {
        if (!active) return;
        const message = describeTvMonitorError(error);
        setDiagnostics((current) => ({ ...current, stage: 'error', lastError: message }));
        reportDiagnostic('queue_error', message);
        if (requiresPairing(error)) forgetDevice();
      }
    };

    void fetchQueue();
    const intervalId = window.setInterval(() => void fetchQueue(), QUEUE_POLL_INTERVAL_MS);
    const fetchOnRecovery = () => void fetchQueue();
    const fetchWhenVisible = () => {
      if (!document.hidden) void fetchQueue();
    };
    window.addEventListener('online', fetchOnRecovery);
    window.addEventListener('focus', fetchOnRecovery);
    document.addEventListener('visibilitychange', fetchWhenVisible);
    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener('online', fetchOnRecovery);
      window.removeEventListener('focus', fetchOnRecovery);
      document.removeEventListener('visibilitychange', fetchWhenVisible);
    };
  }, [device, forgetDevice, reportDiagnostic]);

  if (device)
    return (
      <>
        <TvMonitorRenderBoundary
          onError={(error, info) => {
            const message = error.message.slice(0, 1000);
            setDiagnostics((current) => ({ ...current, stage: 'error', renderError: message }));
            reportDiagnostic('render_error', message, { componentStack: info.componentStack?.slice(0, 3000) });
          }}>
          <KitchenMonitorDisplay
            monitorData={monitorData}
            restaurantName={device.restaurantName}
            onAnnouncementPlayback={reportDiagnostic}
          />
        </TvMonitorRenderBoundary>
        <TvMonitorDiagnostics restaurantName={device.restaurantName} snapshot={diagnostics} />
      </>
    );

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'start center',
        px: { xs: 3, md: 6, xl: 9 },
        py: { xs: 2, md: 2.5, xl: 3 },
        color: '#f5f7fb',
        background: 'radial-gradient(circle at 50% 0%, #253d63 0%, #171b24 48%, #101319 100%)',
      }}>
      <Stack alignItems="center" spacing={2} sx={{ width: '90vw', maxWidth: 980, textAlign: 'center' }}>
        <Box>
          <Typography sx={{ fontSize: { xs: 34, md: 52, xl: 68 }, fontWeight: 850, lineHeight: 1.05 }}>
            TV’ni restoranga ulang
          </Typography>
          <Typography sx={{ mt: 1.5, color: alpha('#f5f7fb', 0.68), fontSize: { xs: 18, md: 24, xl: 30 } }}>
            Avtorizatsiyadan o‘tgan xodim telefondan QR-kodni skanerlaydi
          </Typography>
        </Box>

        <Box
          sx={{
            width: { xs: '68vw', sm: '48vw', md: '32vw' },
            height: { xs: '68vw', sm: '48vw', md: '32vw' },
            minWidth: 240,
            minHeight: 240,
            maxWidth: 460,
            maxHeight: 460,
            boxSizing: 'border-box',
            display: 'grid',
            placeItems: 'center',
            p: { xs: 1.5, md: 2.5 },
            borderRadius: { xs: 3, md: 5 },
            bgcolor: '#fff',
            boxShadow: '0 24px 90px rgba(0, 0, 0, 0.36), 0 0 60px rgba(89, 166, 255, 0.16)',
          }}>
          {qrDataUrl ? (
            <Box
              component="img"
              src={qrDataUrl}
              alt="TV pairing QR code"
              sx={{ display: 'block', width: '100%', height: '100%', objectFit: 'contain' }}
            />
          ) : (
            <CircularProgress size={72} />
          )}
        </Box>

        {pairingError ? (
          <Stack spacing={1.5} alignItems="center">
            <Typography color="error.light" sx={{ fontSize: { xs: 17, md: 21, xl: 24 } }}>
              {pairingError}
            </Typography>
            <Button variant="contained" size="large" onClick={() => void createPairing()}>
              Qayta urinish
            </Button>
          </Stack>
        ) : (
          <Typography sx={{ color: alpha('#f5f7fb', 0.5), fontSize: { xs: 14, md: 17, xl: 20 } }}>
            Bog‘langandan keyin TV bu restoranni eslab qoladi
          </Typography>
        )}
      </Stack>
      <TvMonitorDiagnostics snapshot={diagnostics} />
    </Box>
  );
}
