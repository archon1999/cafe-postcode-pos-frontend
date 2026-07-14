import { Icon } from '@iconify/react';
import { Alert, Box, Button, Card, CardContent, Chip, Divider, Stack, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import {
  clearEdgeConnection,
  normalizeEdgeOrigin,
  persistEdgeConnection,
  readEdgeOrigin,
  readEdgeToken,
} from 'shared/api/edgeConnection';
import { PosLogo } from 'shared/ui/PosLogo';

import { requestPairingCode, type PairingCodeResponse } from '../edge-pairing-api';

type PairingClaimResponse = {
  edgeToken: string;
  restaurantId: string;
  terminal: { id: string; name: string };
  detail?: string;
};

export function EdgePairingPage() {
  const navigate = useNavigate();
  const [origin, setOrigin] = useState(readEdgeOrigin());
  const [terminalName, setTerminalName] = useState('POS terminal');
  const [code, setCode] = useState('');
  const [createdCode, setCreatedCode] = useState<PairingCodeResponse | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const hasToken = Boolean(readEdgeToken());

  const createCode = async () => {
    setPending(true);
    setError('');
    try {
      const payload = await requestPairingCode(origin);
      setCreatedCode(payload);
      if (payload.coordinatorUrls[0]) setOrigin(payload.coordinatorUrls[0]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Pairing kodini yaratib bo‘lmadi.');
    } finally {
      setPending(false);
    }
  };

  const claimCode = async () => {
    setPending(true);
    setError('');
    setMessage('');
    try {
      const normalizedOrigin = normalizeEdgeOrigin(origin);
      const response = await fetch(`${normalizedOrigin}/v1/pairing/claim`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim(), terminalName: terminalName.trim() }),
      });
      const payload = (await response.json().catch(() => ({}))) as PairingClaimResponse;
      if (!response.ok || !payload.edgeToken) throw new Error(payload.detail || `Coordinator HTTP ${response.status}`);
      persistEdgeConnection(normalizedOrigin, payload.edgeToken, payload.restaurantId);
      setMessage(`${payload.terminal.name} ulandi. POS qayta ochilmoqda…`);
      window.setTimeout(() => window.location.assign('/restaurant-login'), 600);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Terminalni ulab bo‘lmadi.');
    } finally {
      setPending(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', px: 2, py: { xs: 3, md: 6 } }}>
      <Stack spacing={3} sx={{ maxWidth: 760, mx: 'auto' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <PosLogo isSingle={false} sx={{ width: 165, height: 48 }} />
          <Button onClick={() => navigate('/restaurant-login')} startIcon={<Icon icon="solar:arrow-left-linear" />}>
            POS’ga qaytish
          </Button>
        </Stack>

        <Stack spacing={1}>
          <Typography variant="h3">Kassani lokal coordinatorga ulash</Typography>
          <Typography color="text.secondary">
            Bir restoranda bitta local agent coordinator bo‘ladi. Qolgan kassalar shu IP manzil va bir martalik kod
            orqali ulanadi.
          </Typography>
        </Stack>

        {error ? <Alert severity="error">{error}</Alert> : null}
        {message ? <Alert severity="success">{message}</Alert> : null}
        {hasToken ? (
          <Chip color="success" label="Bu terminal pairing qilingan" sx={{ alignSelf: 'flex-start' }} />
        ) : null}

        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2.5}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Icon icon="solar:server-square-bold-duotone" width={30} />
                <Stack>
                  <Typography variant="h6">Coordinator kompyuterida</Typography>
                  <Typography color="text.secondary">
                    Yangi kassa uchun 10 daqiqalik bir martalik kod yarating.
                  </Typography>
                </Stack>
              </Stack>
              <Button variant="contained" onClick={createCode} disabled={pending}>
                Pairing kodini yaratish
              </Button>
              {createdCode ? (
                <Alert severity="info" icon={false}>
                  <Stack spacing={1}>
                    <Typography variant="overline">Pairing kodi</Typography>
                    <Typography variant="h2" sx={{ letterSpacing: '0.18em' }}>
                      {createdCode.code}
                    </Typography>
                    <Typography variant="body2">
                      Coordinator: {createdCode.coordinatorUrls.join(', ') || origin}
                    </Typography>
                  </Stack>
                </Alert>
              ) : null}
            </Stack>
          </CardContent>
        </Card>

        <Divider>YANGI KASSADA</Divider>

        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <TextField
                label="Coordinator manzili"
                value={origin}
                onChange={(event) => setOrigin(event.target.value)}
                placeholder="http://192.168.1.10:18181"
              />
              <TextField
                label="Terminal nomi"
                value={terminalName}
                onChange={(event) => setTerminalName(event.target.value)}
                inputProps={{ maxLength: 100 }}
              />
              <TextField
                label="6 xonali pairing kodi"
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                inputProps={{ inputMode: 'numeric', maxLength: 6 }}
              />
              <Button
                variant="contained"
                onClick={claimCode}
                disabled={pending || code.length !== 6 || !terminalName.trim()}>
                Terminalni ulash
              </Button>
              {hasToken ? (
                <Button
                  color="error"
                  onClick={() => {
                    clearEdgeConnection();
                    window.location.reload();
                  }}>
                  Pairing ma’lumotini o‘chirish
                </Button>
              ) : null}
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}
