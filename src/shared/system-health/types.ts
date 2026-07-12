export type SystemHealthComponent = {
  configured: boolean;
  online: boolean;
  state: 'online' | 'offline' | 'not_configured' | 'unknown' | string;
  detail?: string;
  checkedAt?: string;
  items?: Array<{
    id?: string;
    name?: string;
    provider?: string;
    online: boolean;
    detail?: string;
    checkedAt: string;
  }>;
};

export type EdgeSyncFailure = {
  operationId: string;
  path: string;
  lastError: string;
  responseStatus?: number;
  updatedAt?: string;
};

export type EdgeSystemStatus = {
  agent: {
    online: boolean;
    version: string;
    restaurantId?: string;
  };
  backend: {
    online: boolean;
    offlineMode: boolean;
    detail?: string;
  };
  sync: {
    ready: boolean;
    serverCursor?: string;
    lastSuccessAt?: string;
    lastAttemptAt?: string;
    lastError?: string;
    pendingOutbox: number;
    failedOutbox: number;
    failedOperations?: EdgeSyncFailure[];
    schemaVersion: number;
    restaurantId?: string;
  };
  fiscal: SystemHealthComponent;
  marta: SystemHealthComponent;
  printer: SystemHealthComponent;
  alerts?: Array<{
    code: string;
    severity: 'warning' | 'error' | string;
    message: string;
  }>;
};

export type EdgeSystemStatusResponse = {
  ok: boolean;
  status: EdgeSystemStatus;
};

export type SystemHealthTone = 'checking' | 'success' | 'offline' | 'warning' | 'error';
