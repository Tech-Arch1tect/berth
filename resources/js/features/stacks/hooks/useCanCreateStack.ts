import { useQuery } from '@tanstack/react-query';
import { StackService } from '../services/stackService';

interface UseCanCreateStackOptions {
  serverid: number;
  enabled?: boolean;
}

export function useCanCreateStack({ serverid, enabled = true }: UseCanCreateStackOptions) {
  return useQuery<boolean, Error>({
    queryKey: ['can-create-stack', serverid],
    queryFn: () => StackService.canCreateStack(serverid),
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    retry: 1,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}
