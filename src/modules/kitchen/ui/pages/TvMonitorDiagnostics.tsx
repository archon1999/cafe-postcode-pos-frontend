/* eslint-disable i18next/no-literal-string */
import { Box, Stack, Typography, alpha } from '@mui/material';
import { Component, type ErrorInfo, type ReactNode, useState } from 'react';

export type TvMonitorDiagnosticSnapshot = {
  stage: 'pairing' | 'loading' | 'online' | 'error';
  lastSuccessAt: string | null;
  preparingCount: number;
  readyCount: number;
  lastError: string;
  renderError: string;
};

function formatDiagnosticTime(value: string | null) {
  if (!value) return '--:--:--';
  const date = new Date(value);
  return [date.getHours(), date.getMinutes(), date.getSeconds()].map((part) => String(part).padStart(2, '0')).join(':');
}

export function TvMonitorDiagnostics({
  restaurantName,
  snapshot,
}: {
  restaurantName?: string;
  snapshot: TvMonitorDiagnosticSnapshot;
}) {
  const [expanded, setExpanded] = useState(true);
  const healthy = snapshot.stage === 'online' && !snapshot.renderError;
  const statusColor = healthy ? '#2ee6ad' : snapshot.stage === 'error' ? '#ff6b72' : '#ffd166';

  return (
    <Box
      component="button"
      type="button"
      data-testid="tv-monitor-diagnostics"
      onClick={() => setExpanded((current) => !current)}
      sx={{
        position: 'fixed',
        zIndex: 3000,
        right: 12,
        bottom: 12,
        width: expanded ? 'min(390px, calc(100vw - 24px))' : 'auto',
        m: 0,
        p: expanded ? 1.5 : 1,
        color: '#f7f9fc',
        textAlign: 'left',
        font: 'inherit',
        border: `1px solid ${alpha(statusColor, 0.45)}`,
        borderRadius: 2,
        backgroundColor: 'rgba(8, 11, 16, 0.9)',
        boxShadow: '0 10px 32px rgba(0, 0, 0, 0.34)',
        backdropFilter: 'blur(8px)',
        cursor: 'pointer',
      }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Box
            sx={{
              width: 9,
              height: 9,
              borderRadius: '50%',
              bgcolor: statusColor,
              boxShadow: `0 0 12px ${statusColor}`,
            }}
          />
          <Typography sx={{ color: '#fff', fontSize: 14, fontWeight: 850, lineHeight: 1 }}>
            TV DIAG · {snapshot.stage.toUpperCase()}
          </Typography>
        </Stack>
        <Typography sx={{ color: alpha('#fff', 0.58), fontSize: 12 }}>{expanded ? 'yopish' : 'ochish'}</Typography>
      </Stack>

      {expanded ? (
        <Stack spacing={0.45} sx={{ mt: 1.1 }}>
          <Typography sx={{ color: alpha('#fff', 0.8), fontSize: 13 }}>
            Restoran: {restaurantName || 'pairing kutilmoqda'}
          </Typography>
          <Typography sx={{ color: alpha('#fff', 0.8), fontSize: 13 }}>
            Oxirgi OK: {formatDiagnosticTime(snapshot.lastSuccessAt)} · Tayyorlanmoqda: {snapshot.preparingCount} ·
            Tayyor: {snapshot.readyCount}
          </Typography>
          <Typography sx={{ color: alpha('#fff', 0.62), fontSize: 12 }}>
            Network: {navigator.onLine ? 'online' : 'offline'} · Viewport: {window.innerWidth}×{window.innerHeight}
          </Typography>
          {snapshot.lastError ? (
            <Typography sx={{ color: '#ff9da2', fontSize: 12, overflowWrap: 'anywhere' }}>
              Request: {snapshot.lastError}
            </Typography>
          ) : null}
          {snapshot.renderError ? (
            <Typography sx={{ color: '#ff9da2', fontSize: 12, overflowWrap: 'anywhere' }}>
              Render: {snapshot.renderError}
            </Typography>
          ) : null}
        </Stack>
      ) : null}
    </Box>
  );
}

export class TvMonitorRenderBoundary extends Component<
  { children: ReactNode; onError: (error: Error, info: ErrorInfo) => void },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError(error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <Box
        sx={{
          width: '100vw',
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          p: 4,
          color: '#fff',
          background: '#121720',
        }}>
        <Stack spacing={1.5} sx={{ maxWidth: 900, textAlign: 'center' }}>
          <Typography sx={{ fontSize: 44, fontWeight: 850, color: '#ff7b82' }}>TV render xatosi</Typography>
          <Typography sx={{ fontSize: 24, overflowWrap: 'anywhere' }}>{this.state.error.message}</Typography>
          <Typography sx={{ color: alpha('#fff', 0.58), fontSize: 18 }}>
            Diagnostika backend logiga yuborildi.
          </Typography>
        </Stack>
      </Box>
    );
  }
}
