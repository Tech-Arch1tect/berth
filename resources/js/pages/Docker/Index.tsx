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
import { Activity, AlertTriangle, Database, HardDrive, Image, Info, RefreshCw, Server as ServerIcon, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface UserPermissions {
    access: boolean;
    filemanager_access: boolean;
    filemanager_write: boolean;
    'start-stop': boolean;
    exec: boolean;
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

export default function DockerIndex({ server }: Props) {
    const [systemInfo, setSystemInfo] = useState<DockerSystemInfo | null>(null);
    const [diskUsage, setDiskUsage] = useState<DockerDiskUsage | null>(null);
    const [images, setImages] = useState<DockerImage[]>([]);
    const [isLoadingSystemInfo, setIsLoadingSystemInfo] = useState(true);
    const [isLoadingDiskUsage, setIsLoadingDiskUsage] = useState(true);
    const [isLoadingImages, setIsLoadingImages] = useState(true);
    const [systemInfoError, setSystemInfoError] = useState<string | null>(null);
    const [diskUsageError, setDiskUsageError] = useState<string | null>(null);
    const [imagesError, setImagesError] = useState<string | null>(null);
    const [deletingImages, setDeletingImages] = useState<Set<string>>(new Set());
    const [isPruningImages, setIsPruningImages] = useState(false);

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

    const deleteImage = useCallback(async (imageId: string, force = false) => {
        setDeletingImages(prev => new Set(prev).add(imageId));
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
            setDeletingImages(prev => {
                const newSet = new Set(prev);
                newSet.delete(imageId);
                return newSet;
            });
        }
    }, [server.id, fetchImages]);

    const pruneImages = useCallback(async (dangling = true) => {
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
    }, [server.id, fetchImages]);

    const refreshData = useCallback(async () => {
        await Promise.all([fetchSystemInfo(), fetchDiskUsage(), fetchImages()]);
    }, [fetchSystemInfo, fetchDiskUsage, fetchImages]);

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
                            <p className="text-sm text-muted-foreground">
                                Manage Docker resources for {server.display_name}
                            </p>
                        </div>
                    </div>
                    <Button onClick={refreshData} disabled={isLoadingSystemInfo || isLoadingDiskUsage || isLoadingImages}>
                        <RefreshCw className={`mr-2 h-4 w-4 ${(isLoadingSystemInfo || isLoadingDiskUsage || isLoadingImages) ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>

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
                    </TabsList>

                    <TabsContent value="overview" className="space-y-6">
                        {/* System Information */}
                        <Card>
                            <CardHeader>
                                <div className="flex items-center gap-2">
                                    <Info className="h-5 w-5" />
                                    <CardTitle>System Information</CardTitle>
                                </div>
                                <CardDescription>
                                    Docker daemon and system details
                                </CardDescription>
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
                                <CardDescription>
                                    Current container and image counts
                                </CardDescription>
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
                                <CardDescription>
                                    Storage breakdown by resource type
                                </CardDescription>
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
                                                <div className="text-sm text-muted-foreground">Containers ({diskUsage.Containers?.length || 0})</div>
                                            </div>
                                            <div className="space-y-2">
                                                <div className="text-lg font-semibold">{formatBytes(diskUsageStats.volumes)}</div>
                                                <div className="text-sm text-muted-foreground">Volumes ({diskUsage.Volumes?.length || 0})</div>
                                            </div>
                                            <div className="space-y-2">
                                                <div className="text-lg font-semibold">{formatBytes(diskUsageStats.buildCache)}</div>
                                                <div className="text-sm text-muted-foreground">Build Cache ({diskUsage.BuildCache?.length || 0})</div>
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
                                            disabled={isPruningImages}
                                            variant="outline"
                                            size="sm"
                                        >
                                            <Trash2 className={`mr-2 h-4 w-4 ${isPruningImages ? 'animate-spin' : ''}`} />
                                            Prune Dangling
                                        </Button>
                                        <Button
                                            onClick={() => pruneImages(false)}
                                            disabled={isPruningImages}
                                            variant="outline"
                                            size="sm"
                                        >
                                            <AlertTriangle className={`mr-2 h-4 w-4 ${isPruningImages ? 'animate-spin' : ''}`} />
                                            Prune All Unused
                                        </Button>
                                    </div>
                                </div>
                                <CardDescription>
                                    Manage Docker images on this server
                                </CardDescription>
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
                                    <div className="text-center py-8 text-muted-foreground">
                                        No Docker images found on this server
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="rounded-md border">
                                            <div className="grid grid-cols-12 gap-4 p-3 font-medium text-sm bg-muted/50">
                                                <div className="col-span-5">Repository:Tag</div>
                                                <div className="col-span-2">Size</div>
                                                <div className="col-span-2">Created</div>
                                                <div className="col-span-2">In Use</div>
                                                <div className="col-span-1">Actions</div>
                                            </div>
                                            {images.map((image) => (
                                                <div
                                                    key={image.id}
                                                    className="grid grid-cols-12 gap-4 p-3 border-t items-center hover:bg-muted/25"
                                                >
                                                    <div className="col-span-5">
                                                        <div className="space-y-1">
                                                            {image.repo_tags && image.repo_tags.length > 0 ? (
                                                                image.repo_tags.map((tag, idx) => (
                                                                    <div key={idx} className="text-sm font-mono">
                                                                        {tag}
                                                                    </div>
                                                                ))
                                                            ) : (
                                                                <div className="text-sm font-mono text-muted-foreground">
                                                                    &lt;none&gt;:{image.id.substring(7, 19)}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="col-span-2 text-sm">
                                                        {formatBytes(image.size)}
                                                    </div>
                                                    <div className="col-span-2 text-sm">
                                                        {new Date(image.created * 1000).toLocaleDateString()}
                                                    </div>
                                                    <div className="col-span-2 text-sm">
                                                        <div className="flex items-center gap-1">
                                                            <ServerIcon className="h-3 w-3" />
                                                            {image.containers === 0 ? (
                                                                <span className="text-muted-foreground">Not in use</span>
                                                            ) : (
                                                                <span className={image.containers > 0 ? "text-green-600 font-medium" : ""}>
                                                                    {image.containers} container{image.containers !== 1 ? 's' : ''}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="col-span-1">
                                                        <Button
                                                            onClick={() => deleteImage(image.id)}
                                                            disabled={deletingImages.has(image.id)}
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
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
                </Tabs>
            </div>
        </AppLayout>
    );
}