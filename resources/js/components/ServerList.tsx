import ServerCard from './ServerCard';
import EmptyServerState from './EmptyServerState';
import { Server } from '../types/server';
import { useServerStatistics } from '../hooks/useServerStatistics';
import { useMemo } from 'react';

interface ServerListProps {
  servers: Server[];
}

export default function ServerList({ servers }: ServerListProps) {
  const {
    data: serversWithStatistics,
    isLoading: statisticsLoading,
    error: statisticsError,
  } = useServerStatistics();

  const mergedServers = useMemo(() => {
    if (!serversWithStatistics) return servers;

    return servers.map((server) => {
      const serverWithStats = serversWithStatistics.find((s) => s.id === server.id);
      return {
        ...server,
        statistics: serverWithStats?.statistics,
      };
    });
  }, [servers, serversWithStatistics]);

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Servers</h2>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {servers.length} server{servers.length !== 1 ? 's' : ''} configured
        </span>
      </div>

      {servers.length === 0 ? (
        <EmptyServerState />
      ) : (
        <div className="space-y-4">
          {mergedServers.map((server) => (
            <ServerCard
              key={server.id}
              server={server}
              statisticsLoading={statisticsLoading}
              statisticsError={statisticsError}
            />
          ))}
        </div>
      )}
    </div>
  );
}
