/* eslint-disable i18next/no-literal-string */
import { Box, Button, CircularProgress, Stack, Typography, alpha } from '@mui/material';
import axios from 'axios';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { kitchenRepository } from 'modules/kitchen/data-access';
import type {
  KitchenMonitorQueue,
  TvMonitorDeviceRegistration,
  TvMonitorDiagnosticEvent,
  TvMonitorPairingSession,
} from 'modules/kitchen/domain';

import { KitchenMonitorDisplay } from './KitchenMonitorPage';
import {
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
  if (!axios.isAxiosError(error) || error.response?.status !== 401) return false;
  return [
    'device_required',
    'device_revoked',
    'device_proof_invalid',
    'tv_pairing_required',
  ].includes(String(error.response.data?.code || ''));
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
  const [device, setDevice] = useState<TvMonitorDeviceRegistration | null>(null);
  const [pairing, setPairing] = useState<TvMonitorPairingSession | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [autoPairingEnabled, setAutoPairingEnabled] = useState(false);
  const [bootstrapFailed, setBootstrapFailed] = useState(false);
  const [monitorData, setMonitorData] = useState<KitchenMonitorQueue>(EMPTY_QUEUE);
  const [pairingError, setPairingError] = useState('');
  const [announcementAudio] = useState<HTMLAudioElement | null>(() =>
    typeof Audio === 'undefined' ? null : new Audio(),
  );
  const [diagnostics, setDiagnostics] = useState<TvMonitorDiagnosticSnapshot>(INITIAL_DIAGNOSTICS);
  const pairingRequestRef = useRef<Promise<TvMonitorPairingSession> | null>(null);
  const bootstrapRequestRef = useRef<ReturnType<typeof kitchenRepository.bootstrapTvMonitor> | null>(null);
  const lastQueueDiagnosticRef = useRef({ signature: '', reportedAt: 0 });

  const reportDiagnostic = useCallback(
    (event: TvMonitorDiagnosticEvent, message = '', context: Record<string, unknown> = {}) => {
      if (!device) return;
      void kitchenRepository
        .reportTvMonitorDiagnostic({
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
    setAutoPairingEnabled(false);
    setDevice(null);
    setPairing(null);
    setMonitorData(EMPTY_QUEUE);
    setDiagnostics(INITIAL_DIAGNOSTICS);
    void kitchenRepository.forgetTvMonitorDevice().finally(() => setAutoPairingEnabled(true));
  }, []);

  const createPairing = useCallback(async () => {
    setPairingError('');
    const request = pairingRequestRef.current ?? kitchenRepository.createTvMonitorPairing();
    pairingRequestRef.current = request;

    try {
      const nextPairing = await request;
      setPairing(nextPairing);
    } catch {
      setAutoPairingEnabled(false);
      setPairingError('QR yaratib bo‘lmadi. Internet aloqasini tekshiring.');
    } finally {
      pairingRequestRef.current = null;
    }
  }, []);

  const bootstrapTvMonitor = useCallback(async () => {
    setIsBootstrapping(true);
    setBootstrapFailed(false);
    setPairingError('');
    const request = bootstrapRequestRef.current ?? kitchenRepository.bootstrapTvMonitor();
    bootstrapRequestRef.current = request;
    try {
      const result = await request;
      if (result.status === 'paired') {
        setDevice(result.device);
        setPairing(null);
        setAutoPairingEnabled(false);
      } else if (result.status === 'pairing') {
        setPairing(result.pairing);
        setAutoPairingEnabled(false);
      } else {
        setPairing(null);
        setAutoPairingEnabled(true);
      }
    } catch {
      setBootstrapFailed(true);
      setAutoPairingEnabled(false);
      setPairingError('Mavjud TV ulanishini tekshirib bo‘lmadi. Internet aloqasini tekshiring.');
    } finally {
      bootstrapRequestRef.current = null;
      setIsBootstrapping(false);
    }
  }, []);

  useEffect(() => {
    void bootstrapTvMonitor();
  }, [bootstrapTvMonitor]);

  const qrCode = useMemo(() => {
    if (!pairing) return null;
    return { path: pairing.qrPath, viewBoxSize: pairing.qrSize };
  }, [pairing]);

  useEffect(() => {
    if (!isBootstrapping && autoPairingEnabled && !device && !pairing && !pairingRequestRef.current) {
      void createPairing();
    }
  }, [autoPairingEnabled, createPairing, device, isBootstrapping, pairing]);

  useEffect(() => {
    if (device || !pairing) return;

    let active = true;
    const checkPairing = async () => {
      try {
        const status = await kitchenRepository.getTvMonitorPairingStatus(pairing.id, pairing.pollToken);
        if (!active) return;
        if (status.status === 'rejected') {
          setPairing(null);
          setAutoPairingEnabled(false);
          setPairingError('Ulash so‘rovi rad etildi. Qayta urinish uchun yangi QR yarating.');
          return;
        }
        if (status.status === 'expired') {
          setPairing(null);
          setAutoPairingEnabled(true);
          return;
        }
        if (status.status !== 'paired') return;

        const registration: TvMonitorDeviceRegistration = {
          deviceId: status.device.id,
          deviceStatus: status.device.status,
          leaseExpiresAt: status.device.leaseExpiresAt,
          restaurantId: status.restaurantContext.restaurantId,
          restaurantName: status.restaurantContext.restaurantName,
          posMonitorVariant: status.restaurantContext.posMonitorVariant,
        };
        setDevice(registration);
        setPairing(null);
        setAutoPairingEnabled(false);
      } catch (error) {
        if (!active) return;
        if (axios.isAxiosError(error) && error.response?.status === 410) {
          setPairing(null);
          setAutoPairingEnabled(true);
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
        const queue = await kitchenRepository.getTvMonitorQueue();
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
            announcementAudio={announcementAudio}
            announcementPlaybackEnabled
          />
        </TvMonitorRenderBoundary>
      </>
    );

  return (
    <Box
      sx={{
        height: '100vh',
        '@supports (height: 100dvh)': { height: '100dvh' },
        minHeight: 0,
        overflow: 'hidden',
        display: 'grid',
        placeItems: 'center',
        px: { xs: 3, md: 6, xl: 9 },
        py: { xs: 1.5, md: 2 },
        color: '#f5f7fb',
        background: 'radial-gradient(circle at 50% 0%, #253d63 0%, #171b24 48%, #101319 100%)',
      }}>
      <Stack alignItems="center" spacing={1.5} sx={{ width: '90vw', maxWidth: 980, textAlign: 'center' }}>
        <Box>
          <Typography sx={{ fontSize: 'clamp(28px, 5.2vh, 58px)', fontWeight: 850, lineHeight: 1.05 }}>
            TV’ni restoranga ulang
          </Typography>
          <Typography sx={{ mt: 1, color: alpha('#f5f7fb', 0.68), fontSize: 'clamp(16px, 2.8vh, 26px)' }}>
            Superadmin boshqaruv panelidan QR-kodni skanerlang
          </Typography>
        </Box>

        <Box
          sx={{
            width: 'min(52vh, 84vw, 460px)',
            height: 'min(52vh, 84vw, 460px)',
            boxSizing: 'border-box',
            display: 'grid',
            placeItems: 'center',
            p: { xs: 1.5, md: 2.5 },
            borderRadius: { xs: 3, md: 5 },
            bgcolor: '#fff',
            boxShadow: '0 24px 90px rgba(0, 0, 0, 0.36), 0 0 60px rgba(89, 166, 255, 0.16)',
          }}>
          {qrCode ? (
            <Box
              component="svg"
              role="img"
              aria-label="TV pairing QR code"
              viewBox={`0 0 ${qrCode.viewBoxSize} ${qrCode.viewBoxSize}`}
              shapeRendering="crispEdges"
              sx={{ display: 'block', width: '100%', height: '100%' }}>
              <Box component="rect" width="100%" height="100%" fill="#fff" />
              <Box component="path" d={qrCode.path} fill="#000" />
            </Box>
          ) : (
            <CircularProgress size={72} />
          )}
        </Box>

        {pairingError ? (
          <Stack spacing={1.5} alignItems="center">
            <Typography color="error.light" sx={{ fontSize: { xs: 17, md: 21, xl: 24 } }}>
              {pairingError}
            </Typography>
            <Button
              variant="contained"
              size="large"
              onClick={() => {
                if (bootstrapFailed) {
                  void bootstrapTvMonitor();
                  return;
                }
                setAutoPairingEnabled(true);
                void createPairing();
              }}>
              Qayta urinish
            </Button>
          </Stack>
        ) : (
          <Typography sx={{ color: alpha('#f5f7fb', 0.5), fontSize: { xs: 14, md: 17, xl: 20 } }}>
            {isBootstrapping
              ? 'Mavjud xavfsiz ulanish tekshirilmoqda…'
              : pairing
                ? `Tasdiqlash kodi: ${pairing.displayCode}`
                : 'Bog‘langandan keyin TV bu restoranni eslab qoladi'}
          </Typography>
        )}
      </Stack>
    </Box>
  );
}
