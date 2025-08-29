import { useQuery } from '@tanstack/react-query';
import { StackService } from '../services/stackService';
import { StackEnvironmentResponse } from '../types/stack';

interface UseStackEnvironmentVariablesOptions {
  serverid: number;
  stackname: string;
  enabled?: boolean;
}

export const useStackEnvironmentVariables = ({
  serverid,
  stackname,
  enabled = true,
}: UseStackEnvironmentVariablesOptions) => {
  return useQuery<StackEnvironmentResponse, Error>({
    queryKey: ['stackEnvironment', serverid, stackname],
    queryFn: () => StackService.getStackEnvironmentVariables(serverid, stackname),
    enabled: enabled && !!serverid && !!stackname,
    staleTime: 30000,
    gcTime: 300000,
  });
};
