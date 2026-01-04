import { useQuery } from '@tanstack/react-query';
import { StackService } from '../services/stackService';
import { ComposeConfig } from '../types/compose';

interface UseComposeConfigOptions {
  serverId: number;
  stackName: string;
  enabled?: boolean;
}

export const useComposeConfig = ({
  serverId,
  stackName,
  enabled = true,
}: UseComposeConfigOptions) => {
  return useQuery<ComposeConfig, Error>({
    queryKey: ['composeConfig', serverId, stackName],
    queryFn: () => StackService.getComposeConfig(serverId, stackName),
    enabled: enabled && !!serverId && !!stackName,
    staleTime: 30000,
    gcTime: 300000,
  });
};
