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

  const data: StackDetailsResponse = await response.json();

  if (data.services) {
    data.services.sort((a, b) => a.name.localeCompare(b.name));

    data.services.forEach((service) => {
      if (service.containers) {
        service.containers.sort((a, b) => a.name.localeCompare(b.name));
      }
    });
  }

  return data;
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
