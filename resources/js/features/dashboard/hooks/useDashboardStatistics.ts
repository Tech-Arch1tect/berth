import { useQueries } from '@tanstack/react-query';
import { HealthSummary, DashboardServer } from '../types';
import {
  getApiV1ServersServeridStatistics,
  getGetApiV1ServersServeridStatisticsQueryKey,
} from '../../../api/generated/servers/servers';

export interface ServerStat {
  total: number;
  healthy: number;
  unhealthy: number;
}

export interface DashboardStatistics {
  serverStats: Map<number, ServerStat>;
  healthSummary: HealthSummary;
  isLoading: boolean;
  refetch: () => void;
}

export const useDashboardStatistics = (servers: DashboardServer[]): DashboardStatistics => {
  const activeServers = servers.filter((server) => server.is_active);

  const statisticsQueries = useQueries({
    queries: activeServers.map((server) => ({
      queryKey: getGetApiV1ServersServeridStatisticsQueryKey(server.id),
      queryFn: () => getApiV1ServersServeridStatistics(server.id),
      staleTime: 30 * 1000,
      gcTime: 5 * 60 * 1000,
    })),
  });

  const serverStats = new Map<number, ServerStat>();
  let totalStacks = 0;
  let healthyStacks = 0;
  let unhealthyStacks = 0;
  let serversWithErrors = 0;
  let serversLoading = 0;
  let serversOnline = 0;

  statisticsQueries.forEach((query, index) => {
    const server = activeServers[index];
    if (query.isLoading) {
      serversLoading++;
    } else if (query.error) {
      serversWithErrors++;
    } else if (query.data?.data?.statistics) {
      const stats = query.data.data.statistics;
      serversOnline++;
      totalStacks += stats.total_stacks;
      healthyStacks += stats.healthy_stacks;
      unhealthyStacks += stats.unhealthy_stacks;
      serverStats.set(server.id, {
        total: stats.total_stacks,
        healthy: stats.healthy_stacks,
        unhealthy: stats.unhealthy_stacks,
      });
    }
  });

  const configuredInactiveServers = servers.filter((s) => !s.is_active).length;
  const totalOfflineServers = serversWithErrors + configuredInactiveServers;
  const totalActiveServers = activeServers.length;

  const healthSummary: HealthSummary = {
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

  const refetch = () => {
    statisticsQueries.forEach((query) => query.refetch());
  };

  return {
    serverStats,
    healthSummary,
    isLoading: serversLoading > 0,
    refetch,
  };
};
