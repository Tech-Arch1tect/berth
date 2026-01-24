import { useGetApiV1ServersServeridRegistries } from '../api/generated/registries/registries';

interface UseRegistryPermissionsProps {
  serverId: number;
}

export function useRegistryPermissions({ serverId }: UseRegistryPermissionsProps) {
  const { isError, error } = useGetApiV1ServersServeridRegistries(serverId, {
    query: {
      retry: false,
      staleTime: 5 * 60 * 1000,
    },
  });

  const canManage = !isError;

  return {
    data: { canManage },
    isLoading: false,
    isError,
    error,
  };
}
