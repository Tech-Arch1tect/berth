import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

export interface ContainerStats {
  name: string;
  service_name: string;
  cpu_percent: number;
  memory_usage: number;
  memory_limit: number;
  memory_percent: number;
}

export interface StackStats {
  stack_name: string;
  containers: ContainerStats[];
}

const fetchStackStats = async (serverId: number, stackName: string): Promise<StackStats> => {
  const response = await axios.get<StackStats>(
    `/api/servers/${serverId}/stacks/${stackName}/stats`
  );
  return response.data;
};

export const useStackStats = (serverId: number, stackName: string, enabled: boolean = false) => {
  return useQuery({
    queryKey: ['stack-stats', serverId, stackName],
    queryFn: () => fetchStackStats(serverId, stackName),
    enabled: enabled && serverId > 0 && stackName.length > 0,
    refetchInterval: enabled ? 5000 : false,
    staleTime: 1000,
  });
};
