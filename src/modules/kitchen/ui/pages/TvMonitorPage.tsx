/* eslint-disable i18next/no-literal-string */
import { Box, Button, CircularProgress, Stack, Typography, alpha } from '@mui/material';
import axios from 'axios';
import QRCode from 'qrcode';
import { useCallback, useEffect, useRef, useState } from 'react';

import { kitchenRepository, persistTvMonitorDevice, readTvMonitorDevice } from 'modules/kitchen/data-access';
import type { KitchenMonitorQueue, TvMonitorDeviceRegistration, TvMonitorPairingSession } from 'modules/kitchen/domain';

import { KitchenMonitorDisplay } from './KitchenMonitorPage';

const PAIRING_POLL_INTERVAL_MS = 2000;
const QUEUE_POLL_INTERVAL_MS = 5000;
const EMPTY_QUEUE: KitchenMonitorQueue = { preparing: [], recentlyDone: [] };

function requiresPairing(error: unknown) {
  return (
    axios.isAxiosError(error) && error.response?.status === 401 && error.response.data?.code === 'tv_pairing_required'
  );
}

export function TvMonitorPage() {
  const [device, setDevice] = useState<TvMonitorDeviceRegistration | null>(() => readTvMonitorDevice());
  const [pairing, setPairing] = useState<TvMonitorPairingSession | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [monitorData, setMonitorData] = useState<KitchenMonitorQueue>(EMPTY_QUEUE);
  const [pairingError, setPairingError] = useState('');
  const pairingRequestRef = useRef<Promise<TvMonitorPairingSession> | null>(null);

  const forgetDevice = useCallback(() => {
    persistTvMonitorDevice(null);
    setDevice(null);
    setPairing(null);
    setMonitorData(EMPTY_QUEUE);
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

    let active = true;
    const fetchQueue = async () => {
      try {
        const queue = await kitchenRepository.getTvMonitorQueue(device.token);
        if (active) {
          setMonitorData(queue);
          window.CafePostcodeTv?.onQueueSuccess?.();
        }
      } catch (error) {
        if (active && requiresPairing(error)) forgetDevice();
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
  }, [device, forgetDevice]);

  if (device) return <KitchenMonitorDisplay monitorData={monitorData} restaurantName={device.restaurantName} />;

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
    </Box>
  );
}
