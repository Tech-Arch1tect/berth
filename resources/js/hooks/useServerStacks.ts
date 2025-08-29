import { useQuery } from '@tanstack/react-query';
import { usePage } from '@inertiajs/react';
import { StackService } from '../services/stackService';
import { Stack } from '../types/stack';

interface UseServerStacksOptions {
  serverid: number;
  enabled?: boolean;
}

export function useServerStacks({ serverid, enabled = true }: UseServerStacksOptions) {
  const { props } = usePage();
  const csrfToken = props.csrfToken as string | undefined;

  return useQuery<Stack[], Error>({
    queryKey: ['server-stacks', serverid],
    queryFn: () => StackService.getServerStacks(serverid, csrfToken),
    enabled,
    staleTime: 1 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchInterval: 60 * 1000,
    refetchOnWindowFocus: true,
    retry: 1,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}
