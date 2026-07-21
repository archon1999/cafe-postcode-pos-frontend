import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 10_000,
    },
  },
});

export function invalidateQueriesInBackground(queryKeys: ReadonlyArray<readonly unknown[]>) {
  void Promise.allSettled(queryKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}
