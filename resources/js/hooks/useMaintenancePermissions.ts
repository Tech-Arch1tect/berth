import { useGetApiV1ServersServeridMaintenancePermissions } from '../api/generated/maintenance/maintenance';

interface UseMaintenancePermissionsOptions {
  serverid: number;
  enabled?: boolean;
}

export function useMaintenancePermissions({
  serverid,
  enabled = true,
}: UseMaintenancePermissionsOptions) {
  const query = useGetApiV1ServersServeridMaintenancePermissions(serverid, {
    query: {
      enabled,
      staleTime: 5 * 60 * 1000,
      gcTime: 15 * 60 * 1000,
      retry: 1,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      select: (response) => response.data,
    },
  });

  return query;
}
