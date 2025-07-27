import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import type { Server } from '@/types/entities';
import { apiGet } from '@/utils/api';
import { Head } from '@inertiajs/react';
import { Activity, Database, HardDrive, Info, RefreshCw, Server as ServerIcon } from 'lucide-react';
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
    const [isLoadingSystemInfo, setIsLoadingSystemInfo] = useState(true);
    const [isLoadingDiskUsage, setIsLoadingDiskUsage] = useState(true);
    const [systemInfoError, setSystemInfoError] = useState<string | null>(null);
    const [diskUsageError, setDiskUsageError] = useState<string | null>(null);

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

    const refreshData = useCallback(async () => {
        await Promise.all([fetchSystemInfo(), fetchDiskUsage()]);
    }, [fetchSystemInfo, fetchDiskUsage]);

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
                    <Button onClick={refreshData} disabled={isLoadingSystemInfo || isLoadingDiskUsage}>
                        <RefreshCw className={`mr-2 h-4 w-4 ${(isLoadingSystemInfo || isLoadingDiskUsage) ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>

                <Tabs defaultValue="overview" className="space-y-6">
                    <TabsList>
                        <TabsTrigger value="overview" className="flex items-center gap-2">
                            <Activity className="h-4 w-4" />
                            System Overview
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
                </Tabs>
            </div>
        </AppLayout>
    );
}