import { useQuery } from '@tanstack/react-query';
import { usePage } from '@inertiajs/react';
import { StackService } from '../services/stackService';

interface UseCanCreateStackOptions {
  serverid: number;
  enabled?: boolean;
}

export function useCanCreateStack({ serverid, enabled = true }: UseCanCreateStackOptions) {
  const { props } = usePage();
  const csrfToken = props.csrfToken as string | undefined;

  return useQuery<boolean, Error>({
    queryKey: ['can-create-stack', serverid],
    queryFn: () => StackService.canCreateStack(serverid, csrfToken),
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    retry: 1,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}
