import { Icon } from '@iconify/react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { useMemo, useState } from 'react';

import { readTransportConnection } from '../api/edgeConnection';
import type { PosLocale } from '../locale/copy';

import { getSystemHealthCopy } from './copy';
import { useSystemHealthQuery } from './queries';
import { actionRequiredOutboxCount, deriveSystemHealthTone, quarantinedOutboxCount } from './status';
import type { EdgeSystemStatus, SystemHealthComponent } from './types';

type ChipColor = 'default' | 'success' | 'warning' | 'error' | 'secondary';

function StatusRow({ label, value, color = 'default' }: { label: string; value: string; color?: ChipColor }) {
  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1.5} sx={{ minHeight: 32 }}>
      <Typography variant="body2" sx={{ fontWeight: 650 }}>
        {label}
      </Typography>
      <Chip size="small" label={value} color={color} sx={{ fontWeight: 700 }} />
    </Stack>
  );
}

function componentPresentation(
  component: SystemHealthComponent | undefined,
  copy: ReturnType<typeof getSystemHealthCopy>,
) {
  if (!component) return { label: copy.unknown, color: 'default' as ChipColor };
  if (!component.configured) return { label: copy.notConfigured, color: 'default' as ChipColor };
  return component.online
    ? { label: copy.online, color: 'success' as ChipColor }
    : { label: copy.offline, color: 'warning' as ChipColor };
}

function formatDate(value: string | undefined, locale: PosLocale, fallback: string) {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const language = locale === 'ru' ? 'ru-RU' : locale === 'uz-crl' ? 'uz-Cyrl-UZ' : 'uz-UZ';
  return new Intl.DateTimeFormat(language, { dateStyle: 'short', timeStyle: 'medium' }).format(date);
}

function diagnosticsText(status: EdgeSystemStatus | undefined) {
  return JSON.stringify(
    { generatedAt: new Date().toISOString(), transport: readTransportConnection(), status: status ?? null },
    null,
    2,
  );
}

export function SystemHealthPanel({
  enabled,
  locale,
  onRequestCloseMenu,
}: {
  enabled: boolean;
  locale: PosLocale;
  onRequestCloseMenu: () => void;
}) {
  const copy = getSystemHealthCopy(locale);
  const query = useSystemHealthQuery({ enabled });
  const status = query.data?.status;
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const agentRequestFailed = query.isError || query.isRefetchError;
  const unknownPresentation = { label: copy.unknown, color: 'default' as ChipColor };
  const fiscal = agentRequestFailed ? unknownPresentation : componentPresentation(status?.fiscal, copy);
  const marta = agentRequestFailed ? unknownPresentation : componentPresentation(status?.marta, copy);
  const printer = agentRequestFailed ? unknownPresentation : componentPresentation(status?.printer, copy);
  const tone = deriveSystemHealthTone(status, agentRequestFailed);
  const transportMode = readTransportConnection()?.mode ?? 'remote';
  const connectionPresentation =
    transportMode === 'router'
      ? { label: 'Bitta Host / Router', color: 'success' as ChipColor }
      : transportMode === 'local'
        ? { label: 'Local agent', color: 'secondary' as ChipColor }
        : { label: 'Remote Server', color: 'default' as ChipColor };

  const syncPresentation = useMemo(() => {
    if (agentRequestFailed) return { label: copy.unknown, color: 'default' as ChipColor };
    if (!status) return { label: copy.checking, color: 'default' as ChipColor };
    const quarantined = quarantinedOutboxCount(status.sync);
    const actionRequired = actionRequiredOutboxCount(status.sync);
    if (quarantined > 0) return { label: `${copy.quarantined}: ${quarantined}`, color: 'error' as ChipColor };
    if (actionRequired > 0)
      return { label: `${copy.actionRequired}: ${actionRequired}`, color: 'warning' as ChipColor };
    if (status.backend.offlineMode) {
      const suffix = status.sync.pendingOutbox > 0 ? ` · ${status.sync.pendingOutbox} ${copy.queued}` : '';
      return { label: `${copy.offlineMode}${suffix}`, color: 'secondary' as ChipColor };
    }
    if (status.sync.pendingOutbox > 0)
      return { label: `${copy.syncing}: ${status.sync.pendingOutbox}`, color: 'warning' as ChipColor };
    if (status.sync.ready) return { label: copy.synchronized, color: 'success' as ChipColor };
    return { label: copy.checking, color: 'default' as ChipColor };
  }, [agentRequestFailed, copy, status]);

  const openDiagnostics = () => {
    setDiagnosticsOpen(true);
    setCopied(false);
    onRequestCloseMenu();
  };

  const copyDiagnostics = async () => {
    await navigator.clipboard.writeText(diagnosticsText(status));
    setCopied(true);
  };

  return (
    <>
      <Box sx={{ px: 2, py: 1.5, minWidth: 310 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.8 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
            {copy.title}
          </Typography>
          <Tooltip title={copy.diagnosticsHint}>
            <IconButton
              size="small"
              onClick={openDiagnostics}
              color={tone === 'error' ? 'error' : tone === 'warning' ? 'warning' : 'default'}>
              <Icon icon="solar:info-circle-bold-duotone" width={21} />
            </IconButton>
          </Tooltip>
        </Stack>

        <Stack spacing={0.35}>
          <StatusRow
            label={copy.agent}
            value={
              agentRequestFailed || status?.agent.online === false ? copy.offline : status ? copy.online : copy.checking
            }
            color={agentRequestFailed || status?.agent.online === false ? 'error' : status ? 'success' : 'default'}
          />
          <StatusRow label={copy.fiscal} value={fiscal.label} color={fiscal.color} />
          {status?.marta.configured ? <StatusRow label={copy.marta} value={marta.label} color={marta.color} /> : null}
          <StatusRow
            label={copy.connectionAndSync}
            value={connectionPresentation.label}
            color={connectionPresentation.color}
          />
        </Stack>
      </Box>

      <Dialog open={diagnosticsOpen} onClose={() => setDiagnosticsOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{copy.diagnostics}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Stack spacing={0.5}>
              <StatusRow
                label={copy.agent}
                value={
                  agentRequestFailed || status?.agent.online === false
                    ? copy.offline
                    : status
                      ? copy.online
                      : copy.unknown
                }
                color={agentRequestFailed || status?.agent.online === false ? 'error' : status ? 'success' : 'default'}
              />
              <StatusRow
                label={copy.backend}
                value={
                  agentRequestFailed || !status ? copy.unknown : status.backend.online ? copy.online : copy.offlineMode
                }
                color={agentRequestFailed || !status ? 'default' : status.backend.online ? 'success' : 'secondary'}
              />
              <StatusRow label={copy.sync} value={syncPresentation.label} color={syncPresentation.color} />
              <StatusRow label={copy.fiscal} value={fiscal.label} color={fiscal.color} />
              {status?.marta.configured ? (
                <StatusRow label={copy.marta} value={marta.label} color={marta.color} />
              ) : null}
              {status?.printer.configured ? (
                <StatusRow label={copy.printer} value={printer.label} color={printer.color} />
              ) : null}
            </Stack>

            <Divider />

            <Stack spacing={0.8}>
              <Typography variant="subtitle2">{copy.sync}</Typography>
              <Detail label={copy.version} value={status?.agent.version || copy.noData} />
              <Detail label={copy.lastSuccess} value={formatDate(status?.sync.lastSuccessAt, locale, copy.noData)} />
              <Detail label={copy.lastAttempt} value={formatDate(status?.sync.lastAttemptAt, locale, copy.noData)} />
              <Detail label={copy.pending} value={String(status?.sync.pendingOutbox ?? 0)} />
              <Detail label={copy.actionRequired} value={String(status ? actionRequiredOutboxCount(status.sync) : 0)} />
              <Detail label={copy.quarantined} value={String(status ? quarantinedOutboxCount(status.sync) : 0)} />
              <Detail label={copy.resolved} value={String(status?.sync.resolvedOutbox ?? 0)} />
              {status?.backend.detail ? (
                <Typography variant="body2" color="warning.main" sx={{ overflowWrap: 'anywhere' }}>
                  {status.backend.detail}
                </Typography>
              ) : null}
              {status?.fiscal.detail ? (
                <Typography variant="body2" color="warning.main" sx={{ overflowWrap: 'anywhere' }}>
                  {copy.fiscal}: {status.fiscal.detail}
                </Typography>
              ) : null}
              {status?.marta.detail ? (
                <Typography variant="body2" color="warning.main" sx={{ overflowWrap: 'anywhere' }}>
                  {copy.marta}: {status.marta.detail}
                </Typography>
              ) : null}
              {status?.printer.detail ? (
                <Typography variant="body2" color="warning.main" sx={{ overflowWrap: 'anywhere' }}>
                  {copy.printer}: {status.printer.detail}
                </Typography>
              ) : null}
            </Stack>

            {status?.alerts?.length ? (
              <>
                <Divider />
                <Stack spacing={1}>
                  <Typography variant="subtitle2">{copy.failures}</Typography>
                  {status.alerts.map((alert) => (
                    <Box
                      key={alert.code}
                      sx={{
                        p: 1.25,
                        borderRadius: 1.5,
                        bgcolor: alert.severity === 'error' ? 'error.lighter' : 'warning.lighter',
                      }}>
                      <Typography variant="caption" sx={{ fontWeight: 800 }}>
                        {alert.code}
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 0.4, overflowWrap: 'anywhere' }}>
                        {alert.message}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </>
            ) : null}

            {status?.sync.actionRequiredOperations?.length ? (
              <>
                <Divider />
                <Stack spacing={1}>
                  <Typography variant="subtitle2">{copy.actionItems}</Typography>
                  {status.sync.actionRequiredOperations.map((failure) => (
                    <Box key={failure.operationId} sx={{ p: 1.25, borderRadius: 1.5, bgcolor: 'warning.lighter' }}>
                      <Typography variant="caption" sx={{ fontWeight: 800, overflowWrap: 'anywhere' }}>
                        {failure.path} {failure.responseStatus ? `· HTTP ${failure.responseStatus}` : ''}
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 0.4, overflowWrap: 'anywhere' }}>
                        {failure.lastError}
                      </Typography>
                      {failure.resolutionHint ? (
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.4, display: 'block' }}>
                          {failure.errorCode ? `${failure.errorCode} · ` : ''}
                          {failure.resolutionHint}
                        </Typography>
                      ) : null}
                    </Box>
                  ))}
                </Stack>
              </>
            ) : null}

            {(status?.sync.quarantinedOperations ?? status?.sync.failedOperations)?.length ? (
              <>
                <Divider />
                <Stack spacing={1}>
                  <Typography variant="subtitle2">{copy.quarantinedItems}</Typography>
                  {(status?.sync.quarantinedOperations ?? status?.sync.failedOperations ?? []).map((failure) => (
                    <Box key={failure.operationId} sx={{ p: 1.25, borderRadius: 1.5, bgcolor: 'error.lighter' }}>
                      <Typography variant="caption" sx={{ fontWeight: 800, overflowWrap: 'anywhere' }}>
                        {failure.path} {failure.responseStatus ? `· HTTP ${failure.responseStatus}` : ''}
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 0.4, overflowWrap: 'anywhere' }}>
                        {failure.lastError}
                      </Typography>
                      {failure.resolutionHint ? (
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.4, display: 'block' }}>
                          {failure.errorCode ? `${failure.errorCode} · ` : ''}
                          {failure.resolutionHint}
                        </Typography>
                      ) : null}
                    </Box>
                  ))}
                </Stack>
              </>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => void copyDiagnostics()} startIcon={<Icon icon="solar:copy-bold-duotone" width={18} />}>
            {copied ? copy.copied : copy.copy}
          </Button>
          <Box sx={{ flex: 1 }} />
          <Button
            onClick={() => void query.refetch()}
            disabled={query.isFetching}
            startIcon={<Icon icon="solar:refresh-bold-duotone" width={18} />}>
            {copy.refresh}
          </Button>
          <Button variant="contained" onClick={() => setDiagnosticsOpen(false)}>
            {copy.close}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction="row" justifyContent="space-between" spacing={2}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 700, textAlign: 'right', overflowWrap: 'anywhere' }}>
        {value}
      </Typography>
    </Stack>
  );
}
