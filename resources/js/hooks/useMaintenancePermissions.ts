import { useQuery } from '@tanstack/react-query';
import { usePage } from '@inertiajs/react';
import { MaintenanceService } from '../services/maintenanceService';

interface UseMaintenancePermissionsOptions {
  serverid: number;
  enabled?: boolean;
}

export function useMaintenancePermissions({
  serverid,
  enabled = true,
}: UseMaintenancePermissionsOptions) {
  const { props } = usePage();
  const csrfToken = props.csrfToken as string | undefined;

  return useQuery({
    queryKey: ['maintenance-permissions', serverid],
    queryFn: () => MaintenanceService.getPermissions(serverid, csrfToken),
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    retry: 1,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}
