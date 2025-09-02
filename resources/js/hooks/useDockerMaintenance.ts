import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usePage } from '@inertiajs/react';
import axios from 'axios';

export interface SystemInfo {
  version: string;
  api_version: string;
  architecture: string;
  os: string;
  kernel_version: string;
  total_memory: number;
  ncpu: number;
  storage_driver: string;
  docker_root_dir: string;
  server_version: string;
}

export interface DiskUsage {
  layers_size: number;
  images_size: number;
  containers_size: number;
  volumes_size: number;
  build_cache_size: number;
  total_size: number;
}

export interface ImageInfo {
  repository: string;
  tag: string;
  id: string;
  size: number;
  created: string;
  dangling: boolean;
  unused: boolean;
}

export interface ImageSummary {
  total_count: number;
  dangling_count: number;
  unused_count: number;
  total_size: number;
  dangling_size: number;
  unused_size: number;
  images: ImageInfo[];
}

export interface ContainerInfo {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
  created: string;
  size: number;
  labels: { [key: string]: string };
}

export interface ContainerSummary {
  running_count: number;
  stopped_count: number;
  total_count: number;
  total_size: number;
  containers: ContainerInfo[];
}

export interface VolumeInfo {
  name: string;
  driver: string;
  mountpoint: string;
  created: string;
  size: number;
  labels: { [key: string]: string };
  unused: boolean;
}

export interface VolumeSummary {
  total_count: number;
  unused_count: number;
  total_size: number;
  unused_size: number;
  volumes: VolumeInfo[];
}

export interface NetworkInfo {
  id: string;
  name: string;
  driver: string;
  scope: string;
  created: string;
  internal: boolean;
  labels: { [key: string]: string };
  unused: boolean;
  subnet: string;
}

export interface NetworkSummary {
  total_count: number;
  unused_count: number;
  networks: NetworkInfo[];
}

export interface BuildCacheInfo {
  id: string;
  parent?: string;
  type: string;
  size: number;
  created: string;
  last_used: string;
  usage_count: number;
  in_use: boolean;
  shared: boolean;
  description: string;
}

export interface BuildCacheSummary {
  total_count: number;
  total_size: number;
  cache: BuildCacheInfo[];
}

export interface MaintenanceInfo {
  system_info: SystemInfo;
  disk_usage: DiskUsage;
  image_summary: ImageSummary;
  container_summary: ContainerSummary;
  volume_summary: VolumeSummary;
  network_summary: NetworkSummary;
  build_cache_summary: BuildCacheSummary;
  last_updated: string;
}

export interface PruneRequest {
  type: 'images' | 'containers' | 'volumes' | 'networks' | 'build-cache' | 'system';
  force?: boolean;
  all?: boolean;
  filters?: string;
}

export interface DeleteRequest {
  type: 'image' | 'container' | 'volume' | 'network';
  id: string;
}

export interface DeleteResult {
  type: string;
  id: string;
  success: boolean;
  error?: string;
}

export interface PruneResult {
  type: string;
  items_deleted: string[];
  space_reclaimed: number;
  error?: string;
}

const fetchMaintenanceInfo = async (serverid: number): Promise<MaintenanceInfo> => {
  const response = await axios.get<MaintenanceInfo>(`/api/servers/${serverid}/maintenance/info`);
  return response.data;
};

const getHeaders = (csrfToken?: string) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  };
  if (csrfToken) {
    headers['X-CSRF-Token'] = csrfToken;
  }
  return headers;
};

const pruneDocker = async (
  serverid: number,
  request: PruneRequest,
  csrfToken?: string
): Promise<PruneResult> => {
  const response = await axios.post<PruneResult>(
    `/api/servers/${serverid}/maintenance/prune`,
    request,
    { headers: getHeaders(csrfToken) }
  );
  return response.data;
};

const deleteResource = async (
  serverid: number,
  request: DeleteRequest,
  csrfToken?: string
): Promise<DeleteResult> => {
  const response = await axios.delete<DeleteResult>(
    `/api/servers/${serverid}/maintenance/resource`,
    { data: request, headers: getHeaders(csrfToken) }
  );
  return response.data;
};

export const useMaintenanceInfo = (serverid: number, enabled: boolean = true) => {
  return useQuery({
    queryKey: ['maintenance-info', serverid],
    queryFn: () => fetchMaintenanceInfo(serverid),
    enabled: enabled && serverid > 0,
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 25000,
  });
};

export const useDockerPrune = () => {
  const queryClient = useQueryClient();
  const { props } = usePage();
  const csrfToken = props.csrfToken as string | undefined;

  return useMutation({
    mutationFn: ({ serverid, request }: { serverid: number; request: PruneRequest }) =>
      pruneDocker(serverid, request, csrfToken),
    onSuccess: (_, { serverid }) => {
      // Invalidate maintenance info to refresh the data after pruning
      queryClient.invalidateQueries({ queryKey: ['maintenance-info', serverid] });
    },
  });
};

export const useDeleteResource = () => {
  const queryClient = useQueryClient();
  const { props } = usePage();
  const csrfToken = props.csrfToken as string | undefined;

  return useMutation({
    mutationFn: ({ serverid, request }: { serverid: number; request: DeleteRequest }) =>
      deleteResource(serverid, request, csrfToken),
    onSuccess: (_, { serverid }) => {
      // Invalidate maintenance info to refresh the data after deletion
      queryClient.invalidateQueries({ queryKey: ['maintenance-info', serverid] });
    },
  });
};
