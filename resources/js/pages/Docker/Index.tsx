import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import type { Server } from '@/types/entities';
import { apiDelete, apiGet, apiPost } from '@/utils/api';
import { Head } from '@inertiajs/react';
import {
    Activity,
    AlertTriangle,
    Database,
    HardDrive,
    Image,
    Info,
    Network,
    RefreshCw,
    Server as ServerIcon,
    Settings,
    Trash2,
    Volume,
    Zap,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface UserPermissions {
    access: boolean;
    filemanager_access: boolean;
    filemanager_write: boolean;
    'start-stop': boolean;
    exec: boolean;
    docker_maintenance_read: boolean;
    docker_maintenance_write: boolean;
}

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
    NCPU: number;
    MemTotal: number;
    Name: string;
    KernelVersion: string;
    OperatingSystem: string;
    OSType: string;
    IndexServerAddress: string;
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
    status?: Record<string, unknown>;
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

interface DockerDiskUsage {
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
        SizeRw?: number;
        SizeRootFs?: number;
        Labels: Record<string, string>;
        State: string;
        Status: string;
        NetworkSettings: {
            Networks: Record<string, unknown>;
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
        CreatedAt: string;
        Driver: string;
        Labels: Record<string, string>;
        Mountpoint: string;
        Name: string;
        Options: Record<string, string>;
        Scope: string;
        Status?: Record<string, unknown>;
        UsageData?: {
            Size: number;
            RefCount: number;
        };
    }>;
    BuildCache: Array<{
        ID: string;
        Parent?: string;
        Type: string;
        Description: string;
        InUse: boolean;
        Shared: boolean;
        Size: number;
        CreatedAt: string;
        LastUsedAt?: string;
        UsageCount: number;
    }>;
}

interface Props {
    server: Server;
    userPermissions: UserPermissions;
    isAdmin?: boolean;
}

export default function DockerIndex({ server, userPermissions }: Props) {
    const [systemInfo, setSystemInfo] = useState<DockerSystemInfo | null>(null);
    const [diskUsage, setDiskUsage] = useState<DockerDiskUsage | null>(null);
    const [images, setImages] = useState<DockerImage[]>([]);
    const [volumes, setVolumes] = useState<DockerVolume[]>([]);
    const [networks, setNetworks] = useState<DockerNetwork[]>([]);
    const [isLoadingSystemInfo, setIsLoadingSystemInfo] = useState(true);
    const [isLoadingDiskUsage, setIsLoadingDiskUsage] = useState(true);
    const [isLoadingImages, setIsLoadingImages] = useState(true);
    const [isLoadingVolumes, setIsLoadingVolumes] = useState(true);
    const [isLoadingNetworks, setIsLoadingNetworks] = useState(true);
    const [systemInfoError, setSystemInfoError] = useState<string | null>(null);
    const [diskUsageError, setDiskUsageError] = useState<string | null>(null);
    const [imagesError, setImagesError] = useState<string | null>(null);
    const [volumesError, setVolumesError] = useState<string | null>(null);
    const [networksError, setNetworksError] = useState<string | null>(null);
    const [deletingImages, setDeletingImages] = useState<Set<string>>(new Set());
    const [deletingVolumes, setDeletingVolumes] = useState<Set<string>>(new Set());
    const [deletingNetworks, setDeletingNetworks] = useState<Set<string>>(new Set());
    const [isPruningImages, setIsPruningImages] = useState(false);
    const [isPruningVolumes, setIsPruningVolumes] = useState(false);
    const [isPruningNetworks, setIsPruningNetworks] = useState(false);
    const [isPruningBuildCache, setIsPruningBuildCache] = useState(false);
    const [isPerformingSystemPrune, setIsPerformingSystemPrune] = useState(false);

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Servers', href: '/dashboard' },
        { title: server.display_name, href: `/servers/${server.id}/stacks` },
        { title: 'Docker Maintenance', href: `/servers/${server.id}/docker` },
    ];

    const fetchSystemInfo = useCallback(async () => {
        setIsLoadingSystemInfo(true);
        setSystemInfoError(null);
        try {
            const response = await apiGet(`/api/servers/${server.id}/docker/system/info`);
            if (response.success) {
                setSystemInfo(response.data as DockerSystemInfo);
            } else {
                setSystemInfoError(response.error || 'Failed to fetch system information');
            }
        } catch (error) {
            setSystemInfoError(error instanceof Error ? error.message : 'Unknown error occurred');
        } finally {
            setIsLoadingSystemInfo(false);
        }
    }, [server.id]);

    const fetchDiskUsage = useCallback(async () => {
        setIsLoadingDiskUsage(true);
        setDiskUsageError(null);
        try {
            const response = await apiGet(`/api/servers/${server.id}/docker/system/df`);
            if (response.success) {
                setDiskUsage(response.data as DockerDiskUsage);
            } else {
                setDiskUsageError(response.error || 'Failed to fetch disk usage');
            }
        } catch (error) {
            setDiskUsageError(error instanceof Error ? error.message : 'Unknown error occurred');
        } finally {
            setIsLoadingDiskUsage(false);
        }
    }, [server.id]);

    const fetchImages = useCallback(async () => {
        setIsLoadingImages(true);
        setImagesError(null);
        try {
            const response = await apiGet(`/api/servers/${server.id}/docker/images`);
            if (response.success) {
                setImages(response.data as DockerImage[]);
            } else {
                setImagesError(response.error || 'Failed to fetch images');
            }
        } catch (error) {
            setImagesError(error instanceof Error ? error.message : 'Unknown error occurred');
        } finally {
            setIsLoadingImages(false);
        }
    }, [server.id]);

    const deleteImage = useCallback(
        async (imageId: string, force = false) => {
            setDeletingImages((prev) => new Set(prev).add(imageId));
            try {
                const queryParams = new URLSearchParams();
                if (force) {
                    queryParams.set('force', 'true');
                }

                const url = `/api/servers/${server.id}/docker/images/${encodeURIComponent(imageId)}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;

                const response = await apiDelete(url);
                if (response.success) {
                    await fetchImages();
                } else {
                    throw new Error(response.error || 'Failed to delete image');
                }
            } catch (error) {
                console.error('Failed to delete image:', error);
                throw error;
            } finally {
                setDeletingImages((prev) => {
                    const newSet = new Set(prev);
                    newSet.delete(imageId);
                    return newSet;
                });
            }
        },
        [server.id, fetchImages],
    );

    const pruneImages = useCallback(
        async (dangling = true) => {
            setIsPruningImages(true);
            try {
                const response = await apiPost(`/api/servers/${server.id}/docker/images/prune`, {
                    dangling: dangling ? 'true' : 'false',
                });
                if (response.success) {
                    await fetchImages();
                    return response.data;
                } else {
                    throw new Error(response.error || 'Failed to prune images');
                }
            } catch (error) {
                console.error('Failed to prune images:', error);
                throw error;
            } finally {
                setIsPruningImages(false);
            }
        },
        [server.id, fetchImages],
    );

    const fetchVolumes = useCallback(async () => {
        setIsLoadingVolumes(true);
        setVolumesError(null);
        try {
            const response = await apiGet(`/api/servers/${server.id}/docker/volumes`);
            if (response.success) {
                setVolumes(response.data as DockerVolume[]);
            } else {
                setVolumesError(response.error || 'Failed to fetch volumes');
            }
        } catch (error) {
            setVolumesError(error instanceof Error ? error.message : 'Unknown error occurred');
        } finally {
            setIsLoadingVolumes(false);
        }
    }, [server.id]);

    const deleteVolume = useCallback(
        async (volumeName: string, force = false) => {
            setDeletingVolumes((prev) => new Set(prev).add(volumeName));
            try {
                const queryParams = new URLSearchParams();
                if (force) {
                    queryParams.set('force', 'true');
                }

                const url = `/api/servers/${server.id}/docker/volumes/${encodeURIComponent(volumeName)}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;

                const response = await apiDelete(url);
                if (response.success) {
                    await fetchVolumes();
                } else {
                    throw new Error(response.error || 'Failed to delete volume');
                }
            } catch (error) {
                console.error('Failed to delete volume:', error);
                throw error;
            } finally {
                setDeletingVolumes((prev) => {
                    const newSet = new Set(prev);
                    newSet.delete(volumeName);
                    return newSet;
                });
            }
        },
        [server.id, fetchVolumes],
    );

    const pruneVolumes = useCallback(async () => {
        setIsPruningVolumes(true);
        try {
            const response = await apiPost(`/api/servers/${server.id}/docker/volumes/prune`);
            if (response.success) {
                await fetchVolumes();
                return response.data;
            } else {
                throw new Error(response.error || 'Failed to prune volumes');
            }
        } catch (error) {
            console.error('Failed to prune volumes:', error);
            throw error;
        } finally {
            setIsPruningVolumes(false);
        }
    }, [server.id, fetchVolumes]);

    const fetchNetworks = useCallback(async () => {
        setIsLoadingNetworks(true);
        setNetworksError(null);
        try {
            const response = await apiGet(`/api/servers/${server.id}/docker/networks`);
            if (response.success) {
                setNetworks(response.data as DockerNetwork[]);
            } else {
                setNetworksError(response.error || 'Failed to fetch networks');
            }
        } catch (error) {
            setNetworksError(error instanceof Error ? error.message : 'Unknown error occurred');
        } finally {
            setIsLoadingNetworks(false);
        }
    }, [server.id]);

    const deleteNetwork = useCallback(
        async (networkId: string) => {
            setDeletingNetworks((prev) => new Set(prev).add(networkId));
            try {
                const url = `/api/servers/${server.id}/docker/networks/${encodeURIComponent(networkId)}`;

                const response = await apiDelete(url);
                if (response.success) {
                    await fetchNetworks();
                } else {
                    throw new Error(response.error || 'Failed to delete network');
                }
            } catch (error) {
                console.error('Failed to delete network:', error);
                throw error;
            } finally {
                setDeletingNetworks((prev) => {
                    const newSet = new Set(prev);
                    newSet.delete(networkId);
                    return newSet;
                });
            }
        },
        [server.id, fetchNetworks],
    );

    const pruneNetworks = useCallback(async () => {
        setIsPruningNetworks(true);
        try {
            const response = await apiPost(`/api/servers/${server.id}/docker/networks/prune`);
            if (response.success) {
                await fetchNetworks();
                return response.data;
            } else {
                throw new Error(response.error || 'Failed to prune networks');
            }
        } catch (error) {
            console.error('Failed to prune networks:', error);
            throw error;
        } finally {
            setIsPruningNetworks(false);
        }
    }, [server.id, fetchNetworks]);

    const pruneBuildCache = useCallback(
        async (all = false, keepStorage?: string) => {
            setIsPruningBuildCache(true);
            try {
                const body: Record<string, string> = {};
                if (all) {
                    body.all = 'true';
                }
                if (keepStorage) {
                    body['keep-storage'] = keepStorage;
                }

                const response = await apiPost(`/api/servers/${server.id}/docker/buildcache/prune`, body);
                if (response.success) {
                    await fetchDiskUsage();
                    return response.data;
                } else {
                    throw new Error(response.error || 'Failed to prune build cache');
                }
            } catch (error) {
                console.error('Failed to prune build cache:', error);
                throw error;
            } finally {
                setIsPruningBuildCache(false);
            }
        },
        [server.id, fetchDiskUsage],
    );

    const systemPrune = useCallback(
        async (all = false, volumes = false) => {
            setIsPerformingSystemPrune(true);
            try {
                const body: Record<string, string> = {};
                if (all) {
                    body.all = 'true';
                }
                if (volumes) {
                    body.volumes = 'true';
                }

                const response = await apiPost(`/api/servers/${server.id}/docker/system/prune`, body);
                if (response.success) {
                    await Promise.all([fetchSystemInfo(), fetchDiskUsage(), fetchImages(), fetchVolumes(), fetchNetworks()]);
                    return response.data;
                } else {
                    throw new Error(response.error || 'Failed to perform system prune');
                }
            } catch (error) {
                console.error('Failed to perform system prune:', error);
                throw error;
            } finally {
                setIsPerformingSystemPrune(false);
            }
        },
        [server.id, fetchSystemInfo, fetchDiskUsage, fetchImages, fetchVolumes, fetchNetworks],
    );

    const refreshData = useCallback(async () => {
        await Promise.all([fetchSystemInfo(), fetchDiskUsage(), fetchImages(), fetchVolumes(), fetchNetworks()]);
    }, [fetchSystemInfo, fetchDiskUsage, fetchImages, fetchVolumes, fetchNetworks]);

    useEffect(() => {
        refreshData();
    }, [refreshData]);

    const formatBytes = (bytes: number): string => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
    };

    const calculateTotalDiskUsage = (): { total: number; images: number; containers: number; volumes: number; buildCache: number } => {
        if (!diskUsage) return { total: 0, images: 0, containers: 0, volumes: 0, buildCache: 0 };

        const images = diskUsage.Images?.reduce((sum, img) => sum + (img.Size || 0), 0) || 0;
        const containers = diskUsage.Containers?.reduce((sum, container) => sum + ((container.SizeRw || 0) + (container.SizeRootFs || 0)), 0) || 0;
        const volumes = diskUsage.Volumes?.reduce((sum, vol) => sum + (vol.UsageData?.Size || 0), 0) || 0;
        const buildCache = diskUsage.BuildCache?.reduce((sum, cache) => sum + (cache.Size || 0), 0) || 0;

        return {
            total: images + containers + volumes + buildCache,
            images,
            containers,
            volumes,
            buildCache,
        };
    };

    const diskUsageStats = calculateTotalDiskUsage();

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Docker Maintenance - ${server.display_name}`} />

            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                            <HardDrive className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-semibold tracking-tight">Docker Maintenance</h1>
                            <p className="text-sm text-muted-foreground">Manage Docker resources for {server.display_name}</p>
                        </div>
                    </div>
                    <Button
                        onClick={refreshData}
                        disabled={
                            isLoadingSystemInfo ||
                            isLoadingDiskUsage ||
                            isLoadingImages ||
                            isLoadingVolumes ||
                            isLoadingNetworks ||
                            isPruningBuildCache ||
                            isPerformingSystemPrune
                        }
                    >
                        <RefreshCw
                            className={`mr-2 h-4 w-4 ${isLoadingSystemInfo || isLoadingDiskUsage || isLoadingImages || isLoadingVolumes || isLoadingNetworks || isPruningBuildCache || isPerformingSystemPrune ? 'animate-spin' : ''}`}
                        />
                        Refresh
                    </Button>
                </div>

                {!userPermissions.docker_maintenance_read ? (
                    <Card>
                        <CardContent className="flex items-center justify-center py-12">
                            <div className="text-center">
                                <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-destructive" />
                                <h3 className="mb-2 text-lg font-semibold">Access Denied</h3>
                                <p className="text-muted-foreground">
                                    You don't have permission to view Docker maintenance information for this server.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    <Tabs defaultValue="overview" className="space-y-6">
                        <TabsList>
                            <TabsTrigger value="overview" className="flex items-center gap-2">
                                <Activity className="h-4 w-4" />
                                System Overview
                            </TabsTrigger>
                            <TabsTrigger value="images" className="flex items-center gap-2">
                                <Image className="h-4 w-4" />
                                Images ({images.length})
                            </TabsTrigger>
                            <TabsTrigger value="volumes" className="flex items-center gap-2">
                                <Volume className="h-4 w-4" />
                                Volumes ({volumes.length})
                            </TabsTrigger>
                            <TabsTrigger value="networks" className="flex items-center gap-2">
                                <Network className="h-4 w-4" />
                                Networks ({networks.length})
                            </TabsTrigger>
                            <TabsTrigger value="maintenance" className="flex items-center gap-2">
                                <Settings className="h-4 w-4" />
                                Maintenance
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="overview" className="space-y-6">
                            {/* System Information */}
                            <Card>
                                <CardHeader>
                                    <div className="flex items-center gap-2">
                                        <Info className="h-5 w-5" />
                                        <CardTitle>System Information</CardTitle>
                                    </div>
                                    <CardDescription>Docker daemon and system details</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {isLoadingSystemInfo ? (
                                        <div className="space-y-3">
                                            <Skeleton className="h-4 w-3/4" />
                                            <Skeleton className="h-4 w-1/2" />
                                            <Skeleton className="h-4 w-2/3" />
                                        </div>
                                    ) : systemInfoError ? (
                                        <div className="text-destructive">{systemInfoError}</div>
                                    ) : systemInfo ? (
                                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                                            <div className="space-y-1">
                                                <div className="text-sm font-medium">Docker Version</div>
                                                <div className="text-sm text-muted-foreground">{systemInfo.ServerVersion}</div>
                                            </div>
                                            <div className="space-y-1">
                                                <div className="text-sm font-medium">Operating System</div>
                                                <div className="text-sm text-muted-foreground">{systemInfo.OperatingSystem}</div>
                                            </div>
                                            <div className="space-y-1">
                                                <div className="text-sm font-medium">Architecture</div>
                                                <div className="text-sm text-muted-foreground">{systemInfo.Architecture}</div>
                                            </div>
                                            <div className="space-y-1">
                                                <div className="text-sm font-medium">CPU Cores</div>
                                                <div className="text-sm text-muted-foreground">{systemInfo.NCPU}</div>
                                            </div>
                                            <div className="space-y-1">
                                                <div className="text-sm font-medium">Total Memory</div>
                                                <div className="text-sm text-muted-foreground">{formatBytes(systemInfo.MemTotal)}</div>
                                            </div>
                                            <div className="space-y-1">
                                                <div className="text-sm font-medium">Kernel Version</div>
                                                <div className="text-sm text-muted-foreground">{systemInfo.KernelVersion}</div>
                                            </div>
                                        </div>
                                    ) : null}
                                </CardContent>
                            </Card>

                            {/* Container Statistics */}
                            <Card>
                                <CardHeader>
                                    <div className="flex items-center gap-2">
                                        <ServerIcon className="h-5 w-5" />
                                        <CardTitle>Container Statistics</CardTitle>
                                    </div>
                                    <CardDescription>Current container and image counts</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {isLoadingSystemInfo ? (
                                        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                                            {Array.from({ length: 4 }).map((_, i) => (
                                                <div key={i} className="space-y-2">
                                                    <Skeleton className="h-8 w-16" />
                                                    <Skeleton className="h-4 w-20" />
                                                </div>
                                            ))}
                                        </div>
                                    ) : systemInfoError ? (
                                        <div className="text-destructive">{systemInfoError}</div>
                                    ) : systemInfo ? (
                                        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                                            <div className="text-center">
                                                <div className="text-2xl font-bold text-green-600">{systemInfo.ContainersRunning}</div>
                                                <div className="text-sm text-muted-foreground">Running</div>
                                            </div>
                                            <div className="text-center">
                                                <div className="text-2xl font-bold text-red-600">{systemInfo.ContainersStopped}</div>
                                                <div className="text-sm text-muted-foreground">Stopped</div>
                                            </div>
                                            <div className="text-center">
                                                <div className="text-2xl font-bold text-yellow-600">{systemInfo.ContainersPaused}</div>
                                                <div className="text-sm text-muted-foreground">Paused</div>
                                            </div>
                                            <div className="text-center">
                                                <div className="text-2xl font-bold">{systemInfo.Images}</div>
                                                <div className="text-sm text-muted-foreground">Images</div>
                                            </div>
                                        </div>
                                    ) : null}
                                </CardContent>
                            </Card>

                            {/* Disk Usage */}
                            <Card>
                                <CardHeader>
                                    <div className="flex items-center gap-2">
                                        <Database className="h-5 w-5" />
                                        <CardTitle>Disk Usage</CardTitle>
                                    </div>
                                    <CardDescription>Storage breakdown by resource type</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {isLoadingDiskUsage ? (
                                        <div className="space-y-4">
                                            <Skeleton className="h-6 w-1/4" />
                                            <Skeleton className="h-2 w-full" />
                                            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                                                {Array.from({ length: 4 }).map((_, i) => (
                                                    <div key={i} className="space-y-2">
                                                        <Skeleton className="h-6 w-16" />
                                                        <Skeleton className="h-4 w-20" />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : diskUsageError ? (
                                        <div className="text-destructive">{diskUsageError}</div>
                                    ) : diskUsage ? (
                                        <div className="space-y-6">
                                            {/* Total Usage */}
                                            <div>
                                                <div className="mb-2 flex items-center justify-between">
                                                    <span className="text-sm font-medium">Total Docker Storage</span>
                                                    <span className="text-sm text-muted-foreground">{formatBytes(diskUsageStats.total)}</span>
                                                </div>
                                                <Progress value={diskUsageStats.total > 0 ? 75 : 0} className="h-2" />
                                            </div>

                                            <Separator />

                                            {/* Breakdown */}
                                            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                                                <div className="space-y-2">
                                                    <div className="text-lg font-semibold">{formatBytes(diskUsageStats.images)}</div>
                                                    <div className="text-sm text-muted-foreground">Images ({diskUsage.Images?.length || 0})</div>
                                                </div>
                                                <div className="space-y-2">
                                                    <div className="text-lg font-semibold">{formatBytes(diskUsageStats.containers)}</div>
                                                    <div className="text-sm text-muted-foreground">
                                                        Containers ({diskUsage.Containers?.length || 0})
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <div className="text-lg font-semibold">{formatBytes(diskUsageStats.volumes)}</div>
                                                    <div className="text-sm text-muted-foreground">Volumes ({diskUsage.Volumes?.length || 0})</div>
                                                </div>
                                                <div className="space-y-2">
                                                    <div className="text-lg font-semibold">{formatBytes(diskUsageStats.buildCache)}</div>
                                                    <div className="text-sm text-muted-foreground">
                                                        Build Cache ({diskUsage.BuildCache?.length || 0})
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ) : null}
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="images" className="space-y-6">
                            {/* Images Management */}
                            <Card>
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Image className="h-5 w-5" />
                                            <CardTitle>Docker Images</CardTitle>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                onClick={() => pruneImages(true)}
                                                disabled={isPruningImages || !userPermissions.docker_maintenance_write}
                                                variant="outline"
                                                size="sm"
                                                title={
                                                    !userPermissions.docker_maintenance_write
                                                        ? "You don't have permission to perform Docker maintenance operations"
                                                        : ''
                                                }
                                            >
                                                <Trash2 className={`mr-2 h-4 w-4 ${isPruningImages ? 'animate-spin' : ''}`} />
                                                Prune Dangling
                                            </Button>
                                            <Button
                                                onClick={() => pruneImages(false)}
                                                disabled={isPruningImages || !userPermissions.docker_maintenance_write}
                                                variant="outline"
                                                size="sm"
                                                title={
                                                    !userPermissions.docker_maintenance_write
                                                        ? "You don't have permission to perform Docker maintenance operations"
                                                        : ''
                                                }
                                            >
                                                <AlertTriangle className={`mr-2 h-4 w-4 ${isPruningImages ? 'animate-spin' : ''}`} />
                                                Prune All Unused
                                            </Button>
                                        </div>
                                    </div>
                                    <CardDescription>Manage Docker images on this server</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {isLoadingImages ? (
                                        <div className="space-y-3">
                                            {Array.from({ length: 5 }).map((_, i) => (
                                                <div key={i} className="flex items-center space-x-4">
                                                    <Skeleton className="h-4 w-4" />
                                                    <Skeleton className="h-4 flex-1" />
                                                    <Skeleton className="h-4 w-20" />
                                                    <Skeleton className="h-4 w-16" />
                                                </div>
                                            ))}
                                        </div>
                                    ) : imagesError ? (
                                        <div className="text-destructive">{imagesError}</div>
                                    ) : images.length === 0 ? (
                                        <div className="py-8 text-center text-muted-foreground">No Docker images found on this server</div>
                                    ) : (
                                        <div className="space-y-4">
                                            <div className="rounded-md border">
                                                <div className="grid grid-cols-12 gap-4 bg-muted/50 p-3 text-sm font-medium">
                                                    <div className="col-span-5">Repository:Tag</div>
                                                    <div className="col-span-2">Size</div>
                                                    <div className="col-span-2">Created</div>
                                                    <div className="col-span-2">In Use</div>
                                                    <div className="col-span-1">Actions</div>
                                                </div>
                                                {images.map((image) => (
                                                    <div
                                                        key={image.id}
                                                        className="grid grid-cols-12 items-center gap-4 border-t p-3 hover:bg-muted/25"
                                                    >
                                                        <div className="col-span-5">
                                                            <div className="space-y-1">
                                                                {image.repo_tags && image.repo_tags.length > 0 ? (
                                                                    image.repo_tags.map((tag, idx) => (
                                                                        <div key={idx} className="font-mono text-sm">
                                                                            {tag}
                                                                        </div>
                                                                    ))
                                                                ) : (
                                                                    <div className="font-mono text-sm text-muted-foreground">
                                                                        &lt;none&gt;:{image.id.substring(7, 19)}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="col-span-2 text-sm">{formatBytes(image.size)}</div>
                                                        <div className="col-span-2 text-sm">
                                                            {new Date(image.created * 1000).toLocaleDateString()}
                                                        </div>
                                                        <div className="col-span-2 text-sm">
                                                            <div className="flex items-center gap-1">
                                                                <ServerIcon className="h-3 w-3" />
                                                                {image.containers === 0 ? (
                                                                    <span className="text-muted-foreground">Not in use</span>
                                                                ) : (
                                                                    <span className={image.containers > 0 ? 'font-medium text-green-600' : ''}>
                                                                        {image.containers} container{image.containers !== 1 ? 's' : ''}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="col-span-1">
                                                            <Button
                                                                onClick={() => deleteImage(image.id)}
                                                                disabled={deletingImages.has(image.id) || !userPermissions.docker_maintenance_write}
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                                                                title={
                                                                    !userPermissions.docker_maintenance_write
                                                                        ? "You don't have permission to delete Docker images"
                                                                        : 'Delete image'
                                                                }
                                                            >
                                                                <Trash2 className={`h-3 w-3 ${deletingImages.has(image.id) ? 'animate-spin' : ''}`} />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="volumes" className="space-y-6">
                            {/* Volumes Management */}
                            <Card>
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Volume className="h-5 w-5" />
                                            <CardTitle>Docker Volumes</CardTitle>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                onClick={() => pruneVolumes()}
                                                disabled={isPruningVolumes || !userPermissions.docker_maintenance_write}
                                                variant="outline"
                                                size="sm"
                                                title={
                                                    !userPermissions.docker_maintenance_write
                                                        ? "You don't have permission to perform Docker maintenance operations"
                                                        : ''
                                                }
                                            >
                                                <Trash2 className={`mr-2 h-4 w-4 ${isPruningVolumes ? 'animate-spin' : ''}`} />
                                                Prune Unused
                                            </Button>
                                        </div>
                                    </div>
                                    <CardDescription>Manage Docker volumes on this server</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {isLoadingVolumes ? (
                                        <div className="space-y-3">
                                            {Array.from({ length: 5 }).map((_, i) => (
                                                <div key={i} className="flex items-center space-x-4">
                                                    <Skeleton className="h-4 w-4" />
                                                    <Skeleton className="h-4 flex-1" />
                                                    <Skeleton className="h-4 w-20" />
                                                    <Skeleton className="h-4 w-16" />
                                                </div>
                                            ))}
                                        </div>
                                    ) : volumesError ? (
                                        <div className="text-destructive">{volumesError}</div>
                                    ) : volumes.length === 0 ? (
                                        <div className="py-8 text-center text-muted-foreground">No Docker volumes found on this server</div>
                                    ) : (
                                        <div className="space-y-4">
                                            <div className="rounded-md border">
                                                <div className="grid grid-cols-12 gap-4 bg-muted/50 p-3 text-sm font-medium">
                                                    <div className="col-span-4">Name</div>
                                                    <div className="col-span-2">Driver</div>
                                                    <div className="col-span-2">Scope</div>
                                                    <div className="col-span-3">Created</div>
                                                    <div className="col-span-1">Actions</div>
                                                </div>
                                                {volumes.map((volume) => (
                                                    <div
                                                        key={volume.name}
                                                        className="grid grid-cols-12 items-center gap-4 border-t p-3 hover:bg-muted/25"
                                                    >
                                                        <div className="col-span-4">
                                                            <div className="font-mono text-sm">{volume.name}</div>
                                                        </div>
                                                        <div className="col-span-2 text-sm">{volume.driver}</div>
                                                        <div className="col-span-2 text-sm">
                                                            <span
                                                                className={`inline-block rounded px-2 py-1 text-xs font-medium ${
                                                                    volume.scope === 'local'
                                                                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
                                                                        : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
                                                                }`}
                                                            >
                                                                {volume.scope}
                                                            </span>
                                                        </div>
                                                        <div className="col-span-3 text-sm">
                                                            {volume.created_at ? new Date(volume.created_at).toLocaleDateString() : 'N/A'}
                                                        </div>
                                                        <div className="col-span-1">
                                                            <Button
                                                                onClick={() => deleteVolume(volume.name)}
                                                                disabled={
                                                                    deletingVolumes.has(volume.name) || !userPermissions.docker_maintenance_write
                                                                }
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                                                                title={
                                                                    !userPermissions.docker_maintenance_write
                                                                        ? "You don't have permission to delete Docker volumes"
                                                                        : 'Delete volume'
                                                                }
                                                            >
                                                                <Trash2
                                                                    className={`h-3 w-3 ${deletingVolumes.has(volume.name) ? 'animate-spin' : ''}`}
                                                                />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="networks" className="space-y-6">
                            {/* Networks Management */}
                            <Card>
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Network className="h-5 w-5" />
                                            <CardTitle>Docker Networks</CardTitle>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                onClick={() => pruneNetworks()}
                                                disabled={isPruningNetworks || !userPermissions.docker_maintenance_write}
                                                variant="outline"
                                                size="sm"
                                                title={
                                                    !userPermissions.docker_maintenance_write
                                                        ? "You don't have permission to perform Docker maintenance operations"
                                                        : ''
                                                }
                                            >
                                                <Trash2 className={`mr-2 h-4 w-4 ${isPruningNetworks ? 'animate-spin' : ''}`} />
                                                Prune Unused
                                            </Button>
                                        </div>
                                    </div>
                                    <CardDescription>Manage Docker networks on this server</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {isLoadingNetworks ? (
                                        <div className="space-y-3">
                                            {Array.from({ length: 5 }).map((_, i) => (
                                                <div key={i} className="flex items-center space-x-4">
                                                    <Skeleton className="h-4 w-4" />
                                                    <Skeleton className="h-4 flex-1" />
                                                    <Skeleton className="h-4 w-20" />
                                                    <Skeleton className="h-4 w-16" />
                                                </div>
                                            ))}
                                        </div>
                                    ) : networksError ? (
                                        <div className="text-destructive">{networksError}</div>
                                    ) : networks.length === 0 ? (
                                        <div className="py-8 text-center text-muted-foreground">No Docker networks found on this server</div>
                                    ) : (
                                        <div className="space-y-4">
                                            <div className="rounded-md border">
                                                <div className="grid grid-cols-12 gap-4 bg-muted/50 p-3 text-sm font-medium">
                                                    <div className="col-span-3">Name</div>
                                                    <div className="col-span-2">Driver</div>
                                                    <div className="col-span-2">Scope</div>
                                                    <div className="col-span-1">Internal</div>
                                                    <div className="col-span-3">Created</div>
                                                    <div className="col-span-1">Actions</div>
                                                </div>
                                                {networks.map((network) => (
                                                    <div
                                                        key={network.id}
                                                        className="grid grid-cols-12 items-center gap-4 border-t p-3 hover:bg-muted/25"
                                                    >
                                                        <div className="col-span-3">
                                                            <div className="font-mono text-sm">{network.name}</div>
                                                        </div>
                                                        <div className="col-span-2 text-sm">
                                                            <span
                                                                className={`inline-block rounded px-2 py-1 text-xs font-medium ${
                                                                    network.driver === 'bridge'
                                                                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                                                                        : network.driver === 'host'
                                                                          ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300'
                                                                          : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
                                                                }`}
                                                            >
                                                                {network.driver}
                                                            </span>
                                                        </div>
                                                        <div className="col-span-2 text-sm">
                                                            <span
                                                                className={`inline-block rounded px-2 py-1 text-xs font-medium ${
                                                                    network.scope === 'local'
                                                                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
                                                                        : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
                                                                }`}
                                                            >
                                                                {network.scope}
                                                            </span>
                                                        </div>
                                                        <div className="col-span-1 text-sm">
                                                            {network.internal ? (
                                                                <span className="font-medium text-orange-600">Yes</span>
                                                            ) : (
                                                                <span className="text-muted-foreground">No</span>
                                                            )}
                                                        </div>
                                                        <div className="col-span-3 text-sm">
                                                            {network.created ? new Date(network.created).toLocaleDateString() : 'N/A'}
                                                        </div>
                                                        <div className="col-span-1">
                                                            <Button
                                                                onClick={() => deleteNetwork(network.id)}
                                                                disabled={
                                                                    deletingNetworks.has(network.id) ||
                                                                    ['bridge', 'host', 'none'].includes(network.name) ||
                                                                    !userPermissions.docker_maintenance_write
                                                                }
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                                                                title={
                                                                    ['bridge', 'host', 'none'].includes(network.name)
                                                                        ? 'Cannot delete system network'
                                                                        : !userPermissions.docker_maintenance_write
                                                                          ? "You don't have permission to delete Docker networks"
                                                                          : 'Delete network'
                                                                }
                                                            >
                                                                <Trash2
                                                                    className={`h-3 w-3 ${deletingNetworks.has(network.id) ? 'animate-spin' : ''}`}
                                                                />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="maintenance" className="space-y-6">
                            {/* Build Cache Management */}
                            <Card>
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Database className="h-5 w-5" />
                                            <CardTitle>Build Cache</CardTitle>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                onClick={() => pruneBuildCache(false)}
                                                disabled={isPruningBuildCache || !userPermissions.docker_maintenance_write}
                                                variant="outline"
                                                size="sm"
                                                title={
                                                    !userPermissions.docker_maintenance_write
                                                        ? "You don't have permission to perform Docker maintenance operations"
                                                        : ''
                                                }
                                            >
                                                <Trash2 className={`mr-2 h-4 w-4 ${isPruningBuildCache ? 'animate-spin' : ''}`} />
                                                Prune Unused
                                            </Button>
                                            <Button
                                                onClick={() => pruneBuildCache(true)}
                                                disabled={isPruningBuildCache || !userPermissions.docker_maintenance_write}
                                                variant="outline"
                                                size="sm"
                                                title={
                                                    !userPermissions.docker_maintenance_write
                                                        ? "You don't have permission to perform Docker maintenance operations"
                                                        : ''
                                                }
                                            >
                                                <AlertTriangle className={`mr-2 h-4 w-4 ${isPruningBuildCache ? 'animate-spin' : ''}`} />
                                                Prune All
                                            </Button>
                                        </div>
                                    </div>
                                    <CardDescription>Clean up Docker build cache to free disk space</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        <div className="rounded-lg border bg-muted/25 p-4">
                                            <div className="mb-3 flex items-center gap-3">
                                                <Database className="h-5 w-5 text-muted-foreground" />
                                                <div>
                                                    <h4 className="font-medium">Build Cache Storage</h4>
                                                    <p className="text-sm text-muted-foreground">
                                                        Current build cache usage: {diskUsage ? formatBytes(diskUsageStats.buildCache) : 'Loading...'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-sm text-muted-foreground">
                                                <p>
                                                    • <strong>Prune Unused:</strong> Remove only unused build cache entries
                                                </p>
                                                <p>
                                                    • <strong>Prune All:</strong> Remove all build cache entries (more aggressive cleanup)
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* System Prune */}
                            <Card>
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Zap className="h-5 w-5" />
                                            <CardTitle>System Prune</CardTitle>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                onClick={() => systemPrune(false, false)}
                                                disabled={isPerformingSystemPrune || !userPermissions.docker_maintenance_write}
                                                variant="outline"
                                                size="sm"
                                                title={
                                                    !userPermissions.docker_maintenance_write
                                                        ? "You don't have permission to perform Docker maintenance operations"
                                                        : ''
                                                }
                                            >
                                                <Trash2 className={`mr-2 h-4 w-4 ${isPerformingSystemPrune ? 'animate-spin' : ''}`} />
                                                System Prune
                                            </Button>
                                            <Button
                                                onClick={() => systemPrune(false, true)}
                                                disabled={isPerformingSystemPrune || !userPermissions.docker_maintenance_write}
                                                variant="outline"
                                                size="sm"
                                                title={
                                                    !userPermissions.docker_maintenance_write
                                                        ? "You don't have permission to perform Docker maintenance operations"
                                                        : ''
                                                }
                                            >
                                                <Volume className={`mr-2 h-4 w-4 ${isPerformingSystemPrune ? 'animate-spin' : ''}`} />
                                                Prune + Volumes
                                            </Button>
                                            <Button
                                                onClick={() => systemPrune(true, true)}
                                                disabled={isPerformingSystemPrune || !userPermissions.docker_maintenance_write}
                                                variant="destructive"
                                                size="sm"
                                                title={
                                                    !userPermissions.docker_maintenance_write
                                                        ? "You don't have permission to perform Docker maintenance operations"
                                                        : ''
                                                }
                                            >
                                                <AlertTriangle className={`mr-2 h-4 w-4 ${isPerformingSystemPrune ? 'animate-spin' : ''}`} />
                                                Prune All + Volumes
                                            </Button>
                                        </div>
                                    </div>
                                    <CardDescription>Comprehensive cleanup of Docker resources across the system</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        <div className="rounded-lg border bg-muted/25 p-4">
                                            <div className="mb-3 flex items-center gap-3">
                                                <Zap className="h-5 w-5 text-muted-foreground" />
                                                <div>
                                                    <h4 className="font-medium">Current Resource Usage</h4>
                                                    <p className="text-sm text-muted-foreground">
                                                        Total Docker storage: {diskUsage ? formatBytes(diskUsageStats.total) : 'Loading...'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="space-y-1 text-sm text-muted-foreground">
                                                <p>
                                                    • <strong>System Prune:</strong> Remove stopped containers, unused networks, and dangling images
                                                </p>
                                                <p>
                                                    • <strong>Prune + Volumes:</strong> Also remove unused anonymous volumes
                                                </p>
                                                <p>
                                                    • <strong>Prune All + Volumes:</strong> Remove all unused images, not just dangling ones
                                                </p>
                                            </div>
                                        </div>

                                        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
                                            <div className="flex items-start gap-3">
                                                <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
                                                <div>
                                                    <h4 className="mb-1 font-medium text-destructive">Warning</h4>
                                                    <p className="text-sm text-muted-foreground">
                                                        System prune operations will permanently delete Docker resources. Make sure you don't need any
                                                        stopped containers, unused images, or anonymous volumes before proceeding.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                )}
            </div>
        </AppLayout>
    );
}
