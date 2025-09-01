import { useQuery } from '@tanstack/react-query';
import { StackStatistics } from '../types/server';

interface ServerStatisticsResponse {
  statistics: StackStatistics;
}

const fetchServerStatistics = async (serverId: number): Promise<StackStatistics> => {
  const response = await fetch(`/api/servers/${serverId}/statistics`, {
    credentials: 'include',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch server statistics');
  }

  const data: ServerStatisticsResponse = await response.json();
  return data.statistics;
};

export const useServerStatistics = (serverId: number) => {
  return useQuery({
    queryKey: ['server-statistics', serverId],
    queryFn: () => fetchServerStatistics(serverId),
    staleTime: 1 * 1000,
    gcTime: 5 * 60 * 1000,
  });
};
