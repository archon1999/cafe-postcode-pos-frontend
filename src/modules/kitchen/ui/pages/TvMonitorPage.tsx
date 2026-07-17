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
        if (active) setMonitorData(queue);
      } catch (error) {
        if (active && requiresPairing(error)) forgetDevice();
      }
    };

    void fetchQueue();
    const intervalId = window.setInterval(() => void fetchQueue(), QUEUE_POLL_INTERVAL_MS);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [device, forgetDevice]);

  if (device) return <KitchenMonitorDisplay monitorData={monitorData} restaurantName={device.restaurantName} />;

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        p: 'clamp(24px, 5vw, 72px)',
        color: '#f5f7fb',
        background: 'radial-gradient(circle at 50% 0%, #253d63 0%, #171b24 48%, #101319 100%)',
      }}>
      <Stack
        alignItems="center"
        spacing="clamp(18px, 2.5vh, 32px)"
        sx={{ width: 'min(100%, 980px)', textAlign: 'center' }}>
        <Box>
          <Typography sx={{ fontSize: 'clamp(34px, 4vw, 68px)', fontWeight: 850, lineHeight: 1.05 }}>
            TV’ni restoranga ulang
          </Typography>
          <Typography sx={{ mt: 1.5, color: alpha('#f5f7fb', 0.68), fontSize: 'clamp(18px, 1.8vw, 30px)' }}>
            Avtorizatsiyadan o‘tgan xodim telefondan QR-kodni skanerlaydi
          </Typography>
        </Box>

        <Box
          sx={{
            width: 'clamp(260px, 36vw, 500px)',
            aspectRatio: '1',
            display: 'grid',
            placeItems: 'center',
            p: 'clamp(12px, 1.4vw, 20px)',
            borderRadius: 'clamp(24px, 3vw, 40px)',
            bgcolor: '#fff',
            boxShadow: '0 24px 90px rgba(0, 0, 0, 0.36), 0 0 60px rgba(89, 166, 255, 0.16)',
          }}>
          {qrDataUrl ? (
            <Box component="img" src={qrDataUrl} alt="TV pairing QR code" sx={{ width: '100%', height: '100%' }} />
          ) : (
            <CircularProgress size="clamp(54px, 7vw, 92px)" />
          )}
        </Box>

        {pairingError ? (
          <Stack spacing={1.5} alignItems="center">
            <Typography color="error.light" sx={{ fontSize: 'clamp(17px, 1.5vw, 24px)' }}>
              {pairingError}
            </Typography>
            <Button variant="contained" size="large" onClick={() => void createPairing()}>
              Qayta urinish
            </Button>
          </Stack>
        ) : (
          <Typography sx={{ color: alpha('#f5f7fb', 0.5), fontSize: 'clamp(14px, 1.2vw, 20px)' }}>
            Bog‘langandan keyin TV bu restoranni eslab qoladi
          </Typography>
        )}
      </Stack>
    </Box>
  );
}
