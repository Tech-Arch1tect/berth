import { apiDelete, apiGet, apiPost } from '@/utils/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

interface DockerSystemInfo {
    ID: string;
    Containers: number;
    ContainersRunning: number;
    ContainersPaused: number;
    ContainersStopped: number;
    Images: number;
    Driver: string;
    DriverStatus: string[][];
    SystemStatus: string[][];
    ServerVersion: string;
    Architecture: string;
}

interface DockerSystemDf {
    LayersSize: number;
    Images: Array<{
        Id: string;
        ParentId: string;
        RepoTags: string[];
        RepoDigests: string[];
        Created: number;
        Size: number;
        SharedSize: number;
        VirtualSize: number;
        Labels: Record<string, string>;
        Containers: number;
    }>;
    Containers: Array<{
        Id: string;
        Names: string[];
        Image: string;
        ImageID: string;
        Command: string;
        Created: number;
        Ports: Array<{
            IP?: string;
            PrivatePort: number;
            PublicPort?: number;
            Type: string;
        }>;
        SizeRw: number;
        SizeRootFs: number;
        Labels: Record<string, string>;
        State: string;
        Status: string;
        HostConfig: {
            NetworkMode: string;
        };
        NetworkSettings: {
            Networks: Record<
                string,
                {
                    IPAMConfig?: unknown;
                    Links?: string[];
                    Aliases?: string[];
                    NetworkID: string;
                    EndpointID: string;
                    Gateway: string;
                    IPAddress: string;
                    IPPrefixLen: number;
                    IPv6Gateway: string;
                    GlobalIPv6Address: string;
                    GlobalIPv6PrefixLen: number;
                    MacAddress: string;
                }
            >;
        };
        Mounts: Array<{
            Type: string;
            Name?: string;
            Source: string;
            Destination: string;
            Driver?: string;
            Mode: string;
            RW: boolean;
            Propagation: string;
        }>;
    }>;
    Volumes: Array<{
        Name: string;
        Driver: string;
        Mountpoint: string;
        CreatedAt: string;
        Status: Record<string, string | number | boolean>;
        Labels: Record<string, string>;
        Scope: string;
        Options: Record<string, string>;
        UsageData?: {
            Size: number;
            RefCount: number;
        };
    }>;
    BuildCache: Array<{
        ID: string;
        Parent: string;
        Type: string;
        Description: string;
        InUse: boolean;
        Shared: boolean;
        Size: number;
        CreatedAt: string;
        LastUsedAt: string;
        UsageCount: number;
    }>;
}

interface DockerImage {
    id: string;
    repo_tags: string[];
    repo_digests: string[];
    size: number;
    created: number;
    labels: Record<string, string>;
    containers: number;
}

interface DockerVolume {
    name: string;
    driver: string;
    mountpoint: string;
    labels: Record<string, string>;
    scope: string;
    created_at: string;
    status: Record<string, string | number | boolean>;
}

interface DockerNetwork {
    id: string;
    name: string;
    driver: string;
    scope: string;
    internal: boolean;
    labels: Record<string, string>;
    created: string;
}

export function useDockerSystemInfo(serverId: number, enabled = true) {
    return useQuery({
        queryKey: ['servers', serverId, 'docker', 'system', 'info'],
        queryFn: async () => {
            const response = await apiGet<DockerSystemInfo>(`/api/servers/${serverId}/docker/system/info`);
            if (!response.success) {
                throw new Error(response.error || 'Failed to fetch Docker system info');
            }
            return response.data!;
        },
        enabled,
        staleTime: 10 * 1000,
        refetchInterval: 10 * 1000,
    });
}

export function useDockerSystemDf(serverId: number, enabled = true) {
    return useQuery({
        queryKey: ['servers', serverId, 'docker', 'system', 'df'],
        queryFn: async () => {
            const response = await apiGet<DockerSystemDf>(`/api/servers/${serverId}/docker/system/df`);
            if (!response.success) {
                throw new Error(response.error || 'Failed to fetch Docker system df');
            }
            return response.data!;
        },
        enabled,
        staleTime: 10 * 1000,
        refetchInterval: 10 * 1000,
    });
}

export function useDockerImages(serverId: number, enabled = true) {
    return useQuery({
        queryKey: ['servers', serverId, 'docker', 'images'],
        queryFn: async () => {
            const response = await apiGet<DockerImage[]>(`/api/servers/${serverId}/docker/images`);
            if (!response.success) {
                throw new Error(response.error || 'Failed to fetch Docker images');
            }
            return response.data!;
        },
        enabled,
        staleTime: 10 * 1000,
    });
}

export function useDockerVolumes(serverId: number, enabled = true) {
    return useQuery({
        queryKey: ['servers', serverId, 'docker', 'volumes'],
        queryFn: async () => {
            const response = await apiGet<DockerVolume[]>(`/api/servers/${serverId}/docker/volumes`);
            if (!response.success) {
                throw new Error(response.error || 'Failed to fetch Docker volumes');
            }
            return response.data!;
        },
        enabled,
        staleTime: 10 * 1000,
    });
}

export function useDockerNetworks(serverId: number, enabled = true) {
    return useQuery({
        queryKey: ['servers', serverId, 'docker', 'networks'],
        queryFn: async () => {
            const response = await apiGet<DockerNetwork[]>(`/api/servers/${serverId}/docker/networks`);
            if (!response.success) {
                throw new Error(response.error || 'Failed to fetch Docker networks');
            }
            return response.data!;
        },
        enabled,
        staleTime: 10 * 1000,
    });
}

export function useDeleteDockerImage(serverId: number) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ imageId, force = false }: { imageId: string; force?: boolean }) => {
            const url = `/api/servers/${serverId}/docker/images/${imageId}${force ? '?force=true' : ''}`;
            const response = await apiDelete(url);
            if (!response.success) {
                throw new Error(response.error || 'Failed to delete Docker image');
            }
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ['servers', serverId, 'docker', 'images'],
            });
            queryClient.invalidateQueries({
                queryKey: ['servers', serverId, 'docker', 'system', 'df'],
            });
        },
    });
}

export function usePruneDockerImages(serverId: number) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ dangling = true }: { dangling?: boolean } = {}) => {
            const response = await apiPost(`/api/servers/${serverId}/docker/images/prune`, {
                filters: { dangling: [dangling.toString()] },
            });
            if (!response.success) {
                throw new Error(response.error || 'Failed to prune Docker images');
            }
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ['servers', serverId, 'docker', 'images'],
            });
            queryClient.invalidateQueries({
                queryKey: ['servers', serverId, 'docker', 'system', 'df'],
            });
        },
    });
}

export function useDeleteDockerVolume(serverId: number) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ volumeName, force = false }: { volumeName: string; force?: boolean }) => {
            const url = `/api/servers/${serverId}/docker/volumes/${volumeName}${force ? '?force=true' : ''}`;
            const response = await apiDelete(url);
            if (!response.success) {
                throw new Error(response.error || 'Failed to delete Docker volume');
            }
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ['servers', serverId, 'docker', 'volumes'],
            });
            queryClient.invalidateQueries({
                queryKey: ['servers', serverId, 'docker', 'system', 'df'],
            });
        },
    });
}

export function usePruneDockerVolumes(serverId: number) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async () => {
            const response = await apiPost(`/api/servers/${serverId}/docker/volumes/prune`);
            if (!response.success) {
                throw new Error(response.error || 'Failed to prune Docker volumes');
            }
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ['servers', serverId, 'docker', 'volumes'],
            });
            queryClient.invalidateQueries({
                queryKey: ['servers', serverId, 'docker', 'system', 'df'],
            });
        },
    });
}

export function useDeleteDockerNetwork(serverId: number) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (networkId: string) => {
            const response = await apiDelete(`/api/servers/${serverId}/docker/networks/${networkId}`);
            if (!response.success) {
                throw new Error(response.error || 'Failed to delete Docker network');
            }
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ['servers', serverId, 'docker', 'networks'],
            });
        },
    });
}

export function usePruneDockerNetworks(serverId: number) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async () => {
            const response = await apiPost(`/api/servers/${serverId}/docker/networks/prune`);
            if (!response.success) {
                throw new Error(response.error || 'Failed to prune Docker networks');
            }
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ['servers', serverId, 'docker', 'networks'],
            });
        },
    });
}

export function usePruneDockerBuildCache(serverId: number) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ all = false }: { all?: boolean } = {}) => {
            const response = await apiPost(`/api/servers/${serverId}/docker/buildcache/prune`, { all });
            if (!response.success) {
                throw new Error(response.error || 'Failed to prune Docker build cache');
            }
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ['servers', serverId, 'docker', 'system', 'df'],
            });
        },
    });
}

export function usePruneDockerSystem(serverId: number) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ all = false, volumes = false }: { all?: boolean; volumes?: boolean } = {}) => {
            const response = await apiPost(`/api/servers/${serverId}/docker/system/prune`, { all, volumes });
            if (!response.success) {
                throw new Error(response.error || 'Failed to prune Docker system');
            }
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ['servers', serverId, 'docker'],
            });
        },
    });
}
