import { useGetApiV1ServersServeridStacksStackname } from '../api/generated/stacks/stacks';

interface UseStackDetailsParams {
  serverid: number;
  stackname: string;
}

export const useStackDetails = ({ serverid, stackname }: UseStackDetailsParams) => {
  const query = useGetApiV1ServersServeridStacksStackname(serverid, stackname, {
    query: {
      staleTime: 1 * 1000,
      refetchInterval: 120 * 1000,
      refetchIntervalInBackground: true,
      refetchOnWindowFocus: true,
      retry: 1,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      select: (response) => {
        const data = response.data;
        if (data?.services) {
          data.services.sort((a, b) => a.name.localeCompare(b.name));
          data.services.forEach((service) => {
            if (service.containers) {
              service.containers.sort((a, b) => a.name.localeCompare(b.name));
            }
          });
        }
        return response;
      },
    },
  });

  return {
    ...query,

    data: query.data?.data,

    error: query.error ? new Error(String(query.error)) : null,
  };
};
