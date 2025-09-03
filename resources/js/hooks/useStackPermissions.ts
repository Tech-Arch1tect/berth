import { useQuery } from '@tanstack/react-query';
import { usePage } from '@inertiajs/react';
import { StackService, StackPermissions } from '../services/stackService';

interface UseStackPermissionsOptions {
  serverid: number;
  stackname: string;
  enabled?: boolean;
}

export function useStackPermissions({
  serverid,
  stackname,
  enabled = true,
}: UseStackPermissionsOptions) {
  const { props } = usePage();
  const csrfToken = props.csrfToken as string | undefined;

  return useQuery<StackPermissions, Error>({
    queryKey: ['stack-permissions', serverid, stackname],
    queryFn: () => StackService.getStackPermissions(serverid, stackname, csrfToken),
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    retry: 1,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}
