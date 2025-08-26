import { useQuery } from '@tanstack/react-query';
import { StackService } from '../services/stackService';
import { StackEnvironmentResponse } from '../types/stack';

interface UseStackEnvironmentVariablesOptions {
  serverId: number;
  stackName: string;
  enabled?: boolean;
}

export const useStackEnvironmentVariables = ({
  serverId,
  stackName,
  enabled = true,
}: UseStackEnvironmentVariablesOptions) => {
  return useQuery<StackEnvironmentResponse, Error>({
    queryKey: ['stackEnvironment', serverId, stackName],
    queryFn: () => StackService.getStackEnvironmentVariables(serverId, stackName),
    enabled: enabled && !!serverId && !!stackName,
    staleTime: 30000,
    gcTime: 300000,
  });
};
