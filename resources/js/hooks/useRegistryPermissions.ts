import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

interface RegistryPermissions {
  canManage: boolean;
}

interface UseRegistryPermissionsProps {
  serverId: number;
}

export function useRegistryPermissions({ serverId }: UseRegistryPermissionsProps) {
  return useQuery<RegistryPermissions>({
    queryKey: ['registry-permissions', serverId],
    queryFn: async () => {
      try {
        await axios.get(`/api/servers/${serverId}/registries`);
        return { canManage: true };
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 403) {
          return { canManage: false };
        }
        return { canManage: false };
      }
    },
    staleTime: 5 * 60 * 1000,
  });
}
