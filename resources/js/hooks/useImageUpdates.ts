import {
  useGetApiV1ImageUpdates,
  useGetApiV1ServersServeridImageUpdates,
} from '../api/generated/image-updates/image-updates';

interface UseAvailableUpdatesOptions {
  enabled?: boolean;
}

export function useAvailableUpdates({ enabled = true }: UseAvailableUpdatesOptions = {}) {
  const query = useGetApiV1ImageUpdates({
    query: {
      enabled,
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
  });

  return {
    ...query,
    data: query.data?.data?.updates,
  };
}

interface UseServerImageUpdatesOptions {
  serverid: number;
  enabled?: boolean;
}

export function useServerImageUpdates({ serverid, enabled = true }: UseServerImageUpdatesOptions) {
  const query = useGetApiV1ServersServeridImageUpdates(serverid, {
    query: {
      enabled: enabled && !!serverid,
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
  });

  return {
    ...query,
    data: query.data?.data?.updates,
  };
}
