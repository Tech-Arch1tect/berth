import { useQuery } from '@tanstack/react-query';
import type { UseStackDetailsParams, StackDetailsResponse } from '../types/hooks';

const fetchStackDetails = async (
  serverid: number,
  stackname: string
): Promise<StackDetailsResponse> => {
  const response = await fetch(`/api/servers/${serverid}/stacks/${stackname}`);

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

export const useStackDetails = ({ serverid, stackname }: UseStackDetailsParams) => {
  return useQuery({
    queryKey: ['stackDetails', serverid, stackname],
    queryFn: () => fetchStackDetails(serverid, stackname),
    staleTime: 1 * 1000,
    refetchInterval: 120 * 1000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    retry: 1,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
};
