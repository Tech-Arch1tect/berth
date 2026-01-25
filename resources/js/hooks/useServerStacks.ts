import { useQuery } from '@tanstack/react-query';
import { StackService } from '../services/stackService';
import type { Stack } from '../api/generated/models';

interface UseServerStacksOptions {
  serverid: number;
  enabled?: boolean;
}

export function useServerStacks({ serverid, enabled = true }: UseServerStacksOptions) {
  return useQuery<Stack[], Error>({
    queryKey: ['server-stacks', serverid],
    queryFn: () => StackService.getServerStacks(serverid),
    enabled,
    staleTime: 1 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchInterval: 60 * 1000,
    refetchOnWindowFocus: true,
    retry: 1,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}
