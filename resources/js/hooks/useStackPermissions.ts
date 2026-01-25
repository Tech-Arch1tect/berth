import { useQuery } from '@tanstack/react-query';
import { StackService } from '../services/stackService';
import type { StackPermissionsResponse } from '../api/generated/models';

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
  return useQuery<StackPermissionsResponse, Error>({
    queryKey: ['stack-permissions', serverid, stackname],
    queryFn: () => StackService.getStackPermissions(serverid, stackname),
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    retry: 1,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}
