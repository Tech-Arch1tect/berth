import { useGetApiV1ServersServeridStacksStacknameStats } from '../api/generated/stacks/stacks';

export const useStackStats = (serverid: number, stackname: string, enabled: boolean = false) => {
  const query = useGetApiV1ServersServeridStacksStacknameStats(serverid, stackname, {
    query: {
      enabled: enabled && serverid > 0 && stackname.length > 0,
      refetchInterval: enabled ? 1000 : false,
      staleTime: 1000,
    },
  });

  return {
    ...query,

    data: query.data?.data,

    error: query.error ? new Error(String(query.error)) : null,
  };
};
