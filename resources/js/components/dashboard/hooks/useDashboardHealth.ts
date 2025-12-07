import { useQueries } from '@tanstack/react-query';
import { Server } from '../../../types/server';
import { StackStatistics } from '../../../types/server';
import { HealthSummary } from '../types/dashboard';

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

export const useDashboardHealth = (servers: Server[]): HealthSummary => {
  const activeServers = servers.filter((server) => server.is_active);

  const statisticsQueries = useQueries({
    queries: activeServers.map((server) => ({
      queryKey: ['server-statistics', server.id],
      queryFn: () => fetchServerStatistics(server.id),
      staleTime: 1 * 1000,
      gcTime: 5 * 60 * 1000,
    })),
  });

  let totalStacks = 0;
  let healthyStacks = 0;
  let unhealthyStacks = 0;
  let serversWithErrors = 0;
  let serversLoading = 0;
  let serversOnline = 0;

  statisticsQueries.forEach((query) => {
    if (query.isLoading) {
      serversLoading++;
    } else if (query.error) {
      serversWithErrors++;
    } else if (query.data) {
      serversOnline++;
      totalStacks += query.data.total_stacks;
      healthyStacks += query.data.healthy_stacks;
      unhealthyStacks += query.data.unhealthy_stacks;
    }
  });

  const configuredInactiveServers = servers.filter((s) => !s.is_active).length;
  const totalOfflineServers = serversWithErrors + configuredInactiveServers;
  const totalActiveServers = activeServers.length;

  return {
    totalStacks,
    healthyStacks,
    unhealthyStacks,
    serversWithErrors,
    serversLoading,
    serversOnline,
    totalActiveServers,
    totalOfflineServers,
    actuallyReachableServers: serversOnline,
  };
};
