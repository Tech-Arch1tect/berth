import { useQueries } from '@tanstack/react-query';
import { StackService } from '../services/stackService';
import type { Stack } from '../api/generated/models';
import { Server } from '../types/server';

export interface StackWithServer extends Stack {
  server: Server;
}

interface UseAllStacksOptions {
  servers: Server[];
  enabled?: boolean;
}

export function useAllStacks({ servers, enabled = true }: UseAllStacksOptions) {
  const queries = useQueries({
    queries: servers.map((server) => ({
      queryKey: ['server-stacks', server.id],
      queryFn: () => StackService.getServerStacks(server.id),
      enabled: enabled && server.is_active,
      staleTime: 1 * 1000,
      gcTime: 15 * 60 * 1000,
      refetchInterval: 60 * 1000,
      refetchOnWindowFocus: true,
      retry: 1,
      retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
    })),
  });

  const allStacks: StackWithServer[] = queries.flatMap((query, index) => {
    const server = servers[index];
    const stacks = query.data || [];
    return stacks.map((stack) => ({
      ...stack,
      server,
    }));
  });

  const isLoading = queries.some((query) => query.isLoading);
  const isFetching = queries.some((query) => query.isFetching);
  const hasError = queries.some((query) => query.error);
  const errors = queries
    .map((query, index) => ({
      query,
      server: servers[index],
      index,
    }))
    .filter(({ query }) => query.error)
    .map(({ server, query }) => ({
      server,
      error: query.error as Error,
    }));

  const refetchAll = () => {
    queries.forEach((query) => query.refetch());
  };

  return {
    stacks: allStacks,
    isLoading,
    isFetching,
    hasError,
    errors,
    refetchAll,
  };
}
