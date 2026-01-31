import { useGetApiV1ServersServeridStatistics } from '../api/generated/servers/servers';

export const useServerStatistics = (serverId: number) => {
  const { data, isLoading, error, refetch } = useGetApiV1ServersServeridStatistics(serverId, {
    query: {
      staleTime: 1 * 1000,
      gcTime: 5 * 60 * 1000,
    },
  });

  return {
    data: data?.data?.data?.statistics,
    isLoading,
    error,
    refetch,
  };
};
