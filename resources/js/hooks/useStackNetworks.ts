import { useQuery } from '@tanstack/react-query';
import { StackService } from '../services/stackService';
import { Network } from '../types/stack';

interface UseStackNetworksOptions {
  serverId: number;
  stackName: string;
  enabled?: boolean;
}

export const useStackNetworks = ({
  serverId,
  stackName,
  enabled = true,
}: UseStackNetworksOptions) => {
  return useQuery<Network[], Error>({
    queryKey: ['stackNetworks', serverId, stackName],
    queryFn: () => StackService.getStackNetworks(serverId, stackName),
    enabled: enabled && !!serverId && !!stackName,
    staleTime: 30000,
    gcTime: 300000,
  });
};
