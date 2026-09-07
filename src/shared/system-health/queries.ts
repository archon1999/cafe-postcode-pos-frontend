import { useQuery } from '@tanstack/react-query';

import { resolveApiBaseUrl, resolveRemoteApiBaseUrl } from 'shared/api/apiUrl';
import { apiGet } from 'shared/api/client';

import type { EdgeSystemStatusResponse } from './types';

export const systemHealthQueryKey = ['edge', 'system-status'] as const;
export const SYSTEM_HEALTH_POLL_INTERVAL_MS = 60_000;

export function useSystemHealthQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: systemHealthQueryKey,
    // Sign the final route: Django redirects a slashless cloud request, while
    // the Local Agent serves its status endpoint without a trailing slash.
    queryFn: () =>
      apiGet<EdgeSystemStatusResponse>(
        resolveApiBaseUrl() === resolveRemoteApiBaseUrl() ? '/system/status/' : '/system/status',
      ),
    enabled: options?.enabled,
    retry: false,
    refetchInterval: SYSTEM_HEALTH_POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
  });
}
