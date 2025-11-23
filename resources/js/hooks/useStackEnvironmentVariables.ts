import { useQuery } from '@tanstack/react-query';
import { StackService } from '../services/stackService';
import { StackEnvironmentResponse } from '../types/stack';

interface UseStackEnvironmentVariablesOptions {
  serverid: number;
  stackname: string;
  unmask?: boolean;
  enabled?: boolean;
}

export const useStackEnvironmentVariables = ({
  serverid,
  stackname,
  unmask = false,
  enabled = true,
}: UseStackEnvironmentVariablesOptions) => {
  return useQuery<StackEnvironmentResponse, Error>({
    queryKey: ['stackEnvironment', serverid, stackname, unmask],
    queryFn: async () => {
      const data = await StackService.getStackEnvironmentVariables(serverid, stackname, unmask);
      return data;
    },
    enabled: enabled && !!serverid && !!stackname,
    staleTime: 30000,
    gcTime: 300000,
  });
};
