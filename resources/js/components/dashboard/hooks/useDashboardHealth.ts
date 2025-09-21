import { Server } from '../../../types/server';
import { useServerStatistics } from '../../../hooks/useServerStatistics';
import { HealthSummary } from '../types/dashboard';

export const useDashboardHealth = (servers: Server[]): HealthSummary => {
  const serverStatistics = servers
    .filter((server) => server.is_active)
    .map((server) => ({
      server,
      statistics: useServerStatistics(server.id),
    }));

  const getHealthSummary = (): HealthSummary => {
    let totalStacks = 0;
    let healthyStacks = 0;
    let unhealthyStacks = 0;
    let serversWithErrors = 0;
    let serversLoading = 0;
    let serversOnline = 0;

    serverStatistics.forEach(({ statistics }) => {
      if (statistics.isLoading) {
        serversLoading++;
      } else if (statistics.error) {
        serversWithErrors++;
      } else if (statistics.data) {
        serversOnline++;
        totalStacks += statistics.data.total_stacks;
        healthyStacks += statistics.data.healthy_stacks;
        unhealthyStacks += statistics.data.unhealthy_stacks;
      }
    });

    const configuredInactiveServers = servers.filter((s) => !s.is_active).length;
    const totalOfflineServers = serversWithErrors + configuredInactiveServers;
    const totalActiveServers = servers.filter((s) => s.is_active).length;

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

  return getHealthSummary();
};
