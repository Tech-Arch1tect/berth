import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

export interface ContainerStats {
  name: string;
  service_name: string;
  cpu_percent: number;
  cpu_user_time: number;
  cpu_system_time: number;
  memory_usage: number;
  memory_limit: number;
  memory_percent: number;
  memory_rss: number;
  memory_cache: number;
  memory_swap: number;
  page_faults: number;
  page_major_faults: number;
  network_rx_bytes: number;
  network_tx_bytes: number;
  network_rx_packets: number;
  network_tx_packets: number;
  block_read_bytes: number;
  block_write_bytes: number;
  block_read_ops: number;
  block_write_ops: number;
}

export interface StackStats {
  stack_name: string;
  containers: ContainerStats[];
}

const fetchStackStats = async (serverid: number, stackname: string): Promise<StackStats> => {
  const response = await axios.get<StackStats>(
    `/api/servers/${serverid}/stacks/${stackname}/stats`
  );
  return response.data;
};

export const useStackStats = (serverid: number, stackname: string, enabled: boolean = false) => {
  return useQuery({
    queryKey: ['stack-stats', serverid, stackname],
    queryFn: () => fetchStackStats(serverid, stackname),
    enabled: enabled && serverid > 0 && stackname.length > 0,
    refetchInterval: enabled ? 1000 : false,
    staleTime: 1000,
  });
};
