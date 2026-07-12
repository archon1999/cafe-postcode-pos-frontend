import type { EdgeSystemStatus, SystemHealthTone } from './types';

export function deriveSystemHealthTone(
  status: EdgeSystemStatus | undefined,
  agentRequestFailed = false,
): SystemHealthTone {
  if (agentRequestFailed || (status && !status.agent.online)) {
    return 'error';
  }
  if (!status) {
    return 'checking';
  }
  if (status.sync.failedOutbox > 0) {
    return 'error';
  }
  if ((status.fiscal.configured && !status.fiscal.online) || (status.marta.configured && !status.marta.online)) {
    return 'warning';
  }
  if (status.backend.offlineMode) {
    return 'offline';
  }
  if (status.sync.pendingOutbox > 0 || !status.sync.ready) {
    return 'warning';
  }
  return 'success';
}

export const systemHealthToneColors: Record<SystemHealthTone, string> = {
  checking: '#8a94a3',
  success: '#21c985',
  offline: '#6c63d9',
  warning: '#ffb020',
  error: '#ff5963',
};
