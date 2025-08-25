import { useQuery } from '@tanstack/react-query';
import { StackDetails } from '../types/stack';

interface UseStackDetailsParams {
  serverId: number;
  stackName: string;
}

interface StackDetailsResponse extends StackDetails {}

const fetchStackDetails = async (
  serverId: number,
  stackName: string
): Promise<StackDetailsResponse> => {
  const response = await fetch(`/api/servers/${serverId}/stacks/${stackName}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch stack details: ${response.status}`);
  }

  return response.json();
};

export const useStackDetails = ({ serverId, stackName }: UseStackDetailsParams) => {
  return useQuery({
    queryKey: ['stackDetails', serverId, stackName],
    queryFn: () => fetchStackDetails(serverId, stackName),
    staleTime: 1 * 1000,
    refetchInterval: 10 * 1000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    retry: 1,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
};
