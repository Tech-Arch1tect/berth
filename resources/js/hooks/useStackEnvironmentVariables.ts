import { useGetApiV1ServersServeridStacksStacknameEnvironment } from '../api/generated/stacks/stacks';

interface UseStackEnvironmentVariablesOptions {
  serverid: number;
  stackname: string;
  unmask?: boolean;
  enabled?: boolean;
}

export const useStackEnvironmentVariables = ({
  serverid,
  stackname,
  unmask = false,
  enabled = true,
}: UseStackEnvironmentVariablesOptions) => {
  const params = unmask ? { unmask: 'true' } : undefined;
  const query = useGetApiV1ServersServeridStacksStacknameEnvironment(serverid, stackname, params, {
    query: {
      enabled: enabled && !!serverid && !!stackname,
      staleTime: 30000,
      gcTime: 300000,
    },
  });

  return {
    ...query,

    data: query.data?.data,

    error: query.error ? new Error(String(query.error)) : null,
  };
};
