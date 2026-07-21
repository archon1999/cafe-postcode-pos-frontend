import { useQuery } from '@tanstack/react-query';

import { apiGet } from 'shared/api/client';

import type { EdgeSystemStatusResponse } from './types';

export const systemHealthQueryKey = ['edge', 'system-status'] as const;
export const SYSTEM_HEALTH_POLL_INTERVAL_MS = 60_000;

export function useSystemHealthQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: systemHealthQueryKey,
    queryFn: () => apiGet<EdgeSystemStatusResponse>('/system/status'),
    enabled: options?.enabled,
    retry: false,
    refetchInterval: SYSTEM_HEALTH_POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
  });
}
