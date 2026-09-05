import type { EdgeSystemStatus, SystemHealthTone } from './types';

export function quarantinedOutboxCount(sync: EdgeSystemStatus['sync']): number {
  return sync.quarantinedOutbox ?? sync.failedOutbox ?? 0;
}

export function actionRequiredOutboxCount(sync: EdgeSystemStatus['sync']): number {
  return sync.actionRequiredOutbox ?? 0;
}

export function deriveSystemHealthTone(
  status: EdgeSystemStatus | undefined,
  agentRequestFailed = false,
  options?: { ignoreSync?: boolean },
): SystemHealthTone {
  if (agentRequestFailed || (status && !status.agent.online)) {
    return 'error';
  }
  if (!status) {
    return 'checking';
  }
  if (quarantinedOutboxCount(status.sync) > 0 || (status.sync.unknownFinancialCommands ?? 0) > 0) {
    return 'error';
  }
  if (actionRequiredOutboxCount(status.sync) > 0) {
    return 'warning';
  }
  if ((status.fiscal.configured && !status.fiscal.online) || (status.marta.configured && !status.marta.online)) {
    return 'warning';
  }
  if (status.fiscal.configured && status.fiscal.state !== 'online') return 'warning';
  if (
    status.fiscal.configured &&
    status.fiscalQueue &&
    (!status.fiscalQueue.known || status.fiscalQueue.lastError || status.fiscalQueue.stale)
  )
    return 'warning';
  if (status.backend.offlineMode) {
    return 'offline';
  }
  if (!options?.ignoreSync && (status.sync.pendingOutbox > 0 || !status.sync.ready)) {
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
