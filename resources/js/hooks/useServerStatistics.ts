import { useQuery } from '@tanstack/react-query';
import { Server } from '../types/server';

interface ServerStatisticsResponse {
  servers: Server[];
}

const fetchServerStatistics = async (): Promise<Server[]> => {
  const response = await fetch('/api/servers/statistics', {
    credentials: 'include',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch server statistics');
  }

  const data: ServerStatisticsResponse = await response.json();
  return data.servers;
};

export const useServerStatistics = () => {
  return useQuery({
    queryKey: ['server-statistics'],
    queryFn: fetchServerStatistics,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
};
