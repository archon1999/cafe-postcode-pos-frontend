import { useQuery } from '@tanstack/react-query';

import { apiGet } from 'shared/api/client';

import type { EdgeSystemStatusResponse } from './types';

export const systemHealthQueryKey = ['edge', 'system-status'] as const;

export function useSystemHealthQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: systemHealthQueryKey,
    queryFn: () => apiGet<EdgeSystemStatusResponse>('/system/status'),
    enabled: options?.enabled,
    retry: false,
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
  });
}
