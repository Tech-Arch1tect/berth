import { useQueryClient } from '@tanstack/react-query';
import {
  useGetApiV1ServersServeridMaintenanceInfo,
  getGetApiV1ServersServeridMaintenanceInfoQueryKey,
  usePostApiV1ServersServeridMaintenancePrune,
  useDeleteApiV1ServersServeridMaintenanceResource,
} from '../api/generated/maintenance/maintenance';
import type {
  PostApiV1ServersServeridMaintenancePruneBody,
  DeleteApiV1ServersServeridMaintenanceResourceBody,
} from '../api/generated/models';

export const useMaintenanceInfo = (serverid: number, enabled: boolean = true) => {
  return useGetApiV1ServersServeridMaintenanceInfo(serverid, {
    query: {
      enabled: enabled && serverid > 0,
      refetchInterval: 30000,
      staleTime: 25000,
      select: (response) => response.data,
    },
  });
};

export const useDockerPrune = () => {
  const queryClient = useQueryClient();

  const mutation = usePostApiV1ServersServeridMaintenancePrune({
    mutation: {
      onSuccess: (_, { serverid }) => {
        queryClient.invalidateQueries({
          queryKey: getGetApiV1ServersServeridMaintenanceInfoQueryKey(serverid),
        });
      },
    },
  });

  return {
    ...mutation,
    mutate: ({
      serverid,
      request,
    }: {
      serverid: number;
      request: PostApiV1ServersServeridMaintenancePruneBody;
    }) => mutation.mutate({ serverid, data: request }),
    mutateAsync: async ({
      serverid,
      request,
    }: {
      serverid: number;
      request: PostApiV1ServersServeridMaintenancePruneBody;
    }) => {
      const response = await mutation.mutateAsync({ serverid, data: request });
      return response.data;
    },
  };
};

export const useDeleteResource = () => {
  const queryClient = useQueryClient();

  const mutation = useDeleteApiV1ServersServeridMaintenanceResource({
    mutation: {
      onSuccess: (_, { serverid }) => {
        queryClient.invalidateQueries({
          queryKey: getGetApiV1ServersServeridMaintenanceInfoQueryKey(serverid),
        });
      },
    },
  });

  return {
    ...mutation,
    mutate: ({
      serverid,
      request,
    }: {
      serverid: number;
      request: DeleteApiV1ServersServeridMaintenanceResourceBody;
    }) => mutation.mutate({ serverid, data: request }),
    mutateAsync: async ({
      serverid,
      request,
    }: {
      serverid: number;
      request: DeleteApiV1ServersServeridMaintenanceResourceBody;
    }) => {
      const response = await mutation.mutateAsync({ serverid, data: request });
      return response.data;
    },
  };
};
