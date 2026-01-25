import { useQuery } from '@tanstack/react-query';
import { StackService } from '../services/stackService';
import type { Network } from '../api/generated/models';

interface UseStackNetworksOptions {
  serverid: number;
  stackname: string;
  enabled?: boolean;
}

export const useStackNetworks = ({
  serverid,
  stackname,
  enabled = true,
}: UseStackNetworksOptions) => {
  return useQuery<Network[], Error>({
    queryKey: ['stackNetworks', serverid, stackname],
    queryFn: () => StackService.getStackNetworks(serverid, stackname),
    enabled: enabled && !!serverid && !!stackname,
    staleTime: 30000,
    gcTime: 300000,
  });
};
