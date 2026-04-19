import { useQueries } from '@tanstack/react-query';
import { HealthSummary, DashboardServer } from '../types/dashboard';
import {
  getApiV1ServersServeridStatistics,
  getGetApiV1ServersServeridStatisticsQueryKey,
} from '../../../api/generated/servers/servers';

export const useDashboardHealth = (servers: DashboardServer[]): HealthSummary => {
  const activeServers = servers.filter((server) => server.is_active);

  const statisticsQueries = useQueries({
    queries: activeServers.map((server) => ({
      queryKey: getGetApiV1ServersServeridStatisticsQueryKey(server.id),
      queryFn: () => getApiV1ServersServeridStatistics(server.id),
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
    } else if (query.data?.data?.statistics) {
      serversOnline++;
      totalStacks += query.data.data.statistics.total_stacks;
      healthyStacks += query.data.data.statistics.healthy_stacks;
      unhealthyStacks += query.data.data.statistics.unhealthy_stacks;
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
