import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    useDeleteDockerImage,
    useDeleteDockerNetwork,
    useDeleteDockerVolume,
    useDockerImages,
    useDockerNetworks,
    useDockerSystemDf,
    useDockerSystemInfo,
    useDockerVolumes,
    usePruneDockerBuildCache,
    usePruneDockerImages,
    usePruneDockerNetworks,
    usePruneDockerSystem,
    usePruneDockerVolumes,
} from '@/hooks/queries';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import type { Server } from '@/types/entities';
import { Head } from '@inertiajs/react';
import { AlertCircle, AlertTriangle, HardDrive, Image, Info, Network, RefreshCw, Trash2, Volume, Zap } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

interface UserPermissions {
    access: boolean;
    filemanager_access: boolean;
    filemanager_write: boolean;
    'start-stop': boolean;
    exec: boolean;
    docker_maintenance_read: boolean;
    docker_maintenance_write: boolean;
}

interface Props {
    server: Server;
    userPermissions: UserPermissions;
    isAdmin?: boolean;
}

export default function DockerIndex({ server, userPermissions }: Props) {
    const [deletingImages, setDeletingImages] = useState<Set<string>>(new Set());
    const [deletingVolumes, setDeletingVolumes] = useState<Set<string>>(new Set());
    const [deletingNetworks, setDeletingNetworks] = useState<Set<string>>(new Set());

    const {
        data: systemInfo,
        isLoading: isLoadingSystemInfo,
        error: systemInfoError,
        refetch: refetchSystemInfo,
        isFetching: isFetchingSystemInfo,
    } = useDockerSystemInfo(server.id);
    const {
        data: diskUsage,
        isLoading: isLoadingDiskUsage,
        error: diskUsageError,
        refetch: refetchDiskUsage,
        isFetching: isFetchingDiskUsage,
    } = useDockerSystemDf(server.id);
    const {
        data: images = [],
        isLoading: isLoadingImages,
        error: imagesError,
        refetch: refetchImages,
        isFetching: isFetchingImages,
    } = useDockerImages(server.id);
    const {
        data: volumes = [],
        isLoading: isLoadingVolumes,
        error: volumesError,
        refetch: refetchVolumes,
        isFetching: isFetchingVolumes,
    } = useDockerVolumes(server.id);
    const {
        data: networks = [],
        isLoading: isLoadingNetworks,
        error: networksError,
        refetch: refetchNetworks,
        isFetching: isFetchingNetworks,
    } = useDockerNetworks(server.id);

    const deleteImageMutation = useDeleteDockerImage(server.id);
    const pruneImagesMutation = usePruneDockerImages(server.id);
    const deleteVolumeMutation = useDeleteDockerVolume(server.id);
    const pruneVolumesMutation = usePruneDockerVolumes(server.id);
    const deleteNetworkMutation = useDeleteDockerNetwork(server.id);
    const pruneNetworksMutation = usePruneDockerNetworks(server.id);
    const pruneBuildCacheMutation = usePruneDockerBuildCache(server.id);
    const pruneSystemMutation = usePruneDockerSystem(server.id);

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Servers', href: '/dashboard' },
        { title: server.display_name, href: `/servers/${server.id}/stacks` },
        { title: 'Docker Maintenance', href: `/servers/${server.id}/docker` },
    ];
    const handleDeleteImage = async (imageId: string, force = false) => {
        setDeletingImages((prev) => new Set(prev).add(imageId));
        try {
            await deleteImageMutation.mutateAsync({ imageId, force });
            toast.success('Image deleted successfully');
        } catch (error) {
            toast.error(`Failed to delete image: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setDeletingImages((prev) => {
                const newSet = new Set(prev);
                newSet.delete(imageId);
                return newSet;
            });
        }
    };

    const handlePruneImages = async (dangling = true) => {
        try {
            const result = await pruneImagesMutation.mutateAsync({ dangling });
            toast.success(`Pruned ${(result as { ImagesDeleted?: unknown[] })?.ImagesDeleted?.length || 0} images`);
        } catch (error) {
            toast.error(`Failed to prune images: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };

    const handleDeleteVolume = async (volumeName: string, force = false) => {
        setDeletingVolumes((prev) => new Set(prev).add(volumeName));
        try {
            await deleteVolumeMutation.mutateAsync({ volumeName, force });
            toast.success('Volume deleted successfully');
        } catch (error) {
            toast.error(`Failed to delete volume: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setDeletingVolumes((prev) => {
                const newSet = new Set(prev);
                newSet.delete(volumeName);
                return newSet;
            });
        }
    };

    const handlePruneVolumes = async () => {
        try {
            const result = await pruneVolumesMutation.mutateAsync();
            toast.success(`Pruned volumes, freed ${(((result as { SpaceReclaimed?: number })?.SpaceReclaimed || 0) / 1024 / 1024).toFixed(2)} MB`);
        } catch (error) {
            toast.error(`Failed to prune volumes: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };

    const handleDeleteNetwork = async (networkId: string) => {
        setDeletingNetworks((prev) => new Set(prev).add(networkId));
        try {
            await deleteNetworkMutation.mutateAsync(networkId);
            toast.success('Network deleted successfully');
        } catch (error) {
            toast.error(`Failed to delete network: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setDeletingNetworks((prev) => {
                const newSet = new Set(prev);
                newSet.delete(networkId);
                return newSet;
            });
        }
    };

    const handlePruneNetworks = async () => {
        try {
            const result = await pruneNetworksMutation.mutateAsync();
            toast.success(`Pruned ${(result as { NetworksDeleted?: unknown[] })?.NetworksDeleted?.length || 0} networks`);
        } catch (error) {
            toast.error(`Failed to prune networks: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };

    const handlePruneBuildCache = async (all = false) => {
        try {
            const result = await pruneBuildCacheMutation.mutateAsync({ all });
            toast.success(
                `Pruned build cache, freed ${(((result as { SpaceReclaimed?: number })?.SpaceReclaimed || 0) / 1024 / 1024).toFixed(2)} MB`,
            );
        } catch (error) {
            toast.error(`Failed to prune build cache: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };

    const handleSystemPrune = async (all = false, volumes = false) => {
        try {
            const result = await pruneSystemMutation.mutateAsync({ all, volumes });
            toast.success(
                `System prune completed, freed ${(((result as { SpaceReclaimed?: number })?.SpaceReclaimed || 0) / 1024 / 1024).toFixed(2)} MB`,
            );
        } catch (error) {
            toast.error(`Failed to perform system prune: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };

    const formatBytes = (bytes: number): string => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const ErrorDisplay = ({ error, retry }: { error: Error; retry: () => void }) => (
        <div className="flex items-center justify-center p-8">
            <div className="text-center">
                <AlertCircle className="mx-auto mb-4 h-12 w-12 text-destructive" />
                <p className="mb-4 text-sm text-muted-foreground">{error?.message || 'Failed to load data'}</p>
                <Button variant="outline" onClick={retry}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Retry
                </Button>
            </div>
        </div>
    );

    const LoadingCard = () => (
        <Card>
            <CardHeader>
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-48" />
            </CardHeader>
            <CardContent>
                <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                </div>
            </CardContent>
        </Card>
    );

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Docker Maintenance - ${server.display_name}`} />

            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Docker Maintenance</h1>
                        <p className="text-muted-foreground">Manage Docker resources on {server.display_name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            onClick={() => {
                                refetchSystemInfo();
                                refetchDiskUsage();
                                refetchImages();
                                refetchVolumes();
                                refetchNetworks();
                            }}
                            disabled={isFetchingSystemInfo || isFetchingDiskUsage || isFetchingImages || isFetchingVolumes || isFetchingNetworks}
                        >
                            <RefreshCw
                                className={`mr-2 h-4 w-4 ${isFetchingSystemInfo || isFetchingDiskUsage || isFetchingImages || isFetchingVolumes || isFetchingNetworks ? 'animate-spin' : ''}`}
                            />
                            Refresh All
                        </Button>
                    </div>
                </div>

                <Tabs defaultValue="overview" className="space-y-6">
                    <TabsList className="grid w-full grid-cols-5">
                        <TabsTrigger value="overview">Overview</TabsTrigger>
                        <TabsTrigger value="images">Images</TabsTrigger>
                        <TabsTrigger value="volumes">Volumes</TabsTrigger>
                        <TabsTrigger value="networks">Networks</TabsTrigger>
                        <TabsTrigger value="cleanup">Cleanup</TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview" className="space-y-6">
                        <div className="grid gap-6 md:grid-cols-2">
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between">
                                    <div>
                                        <CardTitle className="flex items-center gap-2">
                                            <Info className="h-5 w-5" />
                                            System Information
                                        </CardTitle>
                                        <CardDescription>Docker engine details</CardDescription>
                                    </div>
                                    <Button variant="ghost" size="sm" onClick={() => refetchSystemInfo()} disabled={isFetchingSystemInfo}>
                                        <RefreshCw className={`h-4 w-4 ${isFetchingSystemInfo ? 'animate-spin' : ''}`} />
                                    </Button>
                                </CardHeader>
                                <CardContent>
                                    {isLoadingSystemInfo ? (
                                        <div className="space-y-2">
                                            <Skeleton className="h-4 w-full" />
                                            <Skeleton className="h-4 w-3/4" />
                                            <Skeleton className="h-4 w-1/2" />
                                        </div>
                                    ) : systemInfoError ? (
                                        <ErrorDisplay error={systemInfoError} retry={refetchSystemInfo} />
                                    ) : systemInfo ? (
                                        <div className="space-y-3">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <p className="text-sm font-medium">Version</p>
                                                    <p className="text-sm text-muted-foreground">{systemInfo.ServerVersion}</p>
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium">Architecture</p>
                                                    <p className="text-sm text-muted-foreground">{systemInfo.Architecture}</p>
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium">Containers</p>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm text-muted-foreground">{systemInfo.Containers} total</span>
                                                        <span className="text-xs text-green-600">{systemInfo.ContainersRunning} running</span>
                                                    </div>
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium">Images</p>
                                                    <p className="text-sm text-muted-foreground">{systemInfo.Images}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ) : null}
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between">
                                    <div>
                                        <CardTitle className="flex items-center gap-2">
                                            <HardDrive className="h-5 w-5" />
                                            Disk Usage
                                        </CardTitle>
                                        <CardDescription>Storage consumption breakdown</CardDescription>
                                    </div>
                                    <Button variant="ghost" size="sm" onClick={() => refetchDiskUsage()} disabled={isFetchingDiskUsage}>
                                        <RefreshCw className={`h-4 w-4 ${isFetchingDiskUsage ? 'animate-spin' : ''}`} />
                                    </Button>
                                </CardHeader>
                                <CardContent>
                                    {isLoadingDiskUsage ? (
                                        <div className="space-y-4">
                                            <Skeleton className="h-6 w-full" />
                                            <Skeleton className="h-4 w-3/4" />
                                            <Skeleton className="h-4 w-1/2" />
                                        </div>
                                    ) : diskUsageError ? (
                                        <ErrorDisplay error={diskUsageError} retry={refetchDiskUsage} />
                                    ) : diskUsage ? (
                                        <div className="space-y-4">
                                            {diskUsage.Images && (
                                                <div>
                                                    <div className="mb-2 flex items-center justify-between">
                                                        <span className="text-sm font-medium">Images</span>
                                                        <span className="text-sm text-muted-foreground">
                                                            {formatBytes(diskUsage.Images.reduce((sum, img) => sum + img.Size, 0))}
                                                        </span>
                                                    </div>
                                                    <Progress value={diskUsage.Images.length > 0 ? 75 : 0} className="h-2" />
                                                </div>
                                            )}
                                            {diskUsage.Containers && (
                                                <div>
                                                    <div className="mb-2 flex items-center justify-between">
                                                        <span className="text-sm font-medium">Containers</span>
                                                        <span className="text-sm text-muted-foreground">
                                                            {(() => {
                                                                const totalSize = diskUsage.Containers.reduce((sum, cont) => {
                                                                    return sum + (typeof cont.SizeRw === 'number' ? cont.SizeRw : 0);
                                                                }, 0);
                                                                return totalSize > 0 ? formatBytes(totalSize) : '0 B';
                                                            })()}
                                                        </span>
                                                    </div>
                                                    <Progress value={diskUsage.Containers.length > 0 ? 50 : 0} className="h-2" />
                                                </div>
                                            )}
                                            {diskUsage.Volumes && (
                                                <div>
                                                    <div className="mb-2 flex items-center justify-between">
                                                        <span className="text-sm font-medium">Volumes</span>
                                                        <span className="text-sm text-muted-foreground">
                                                            {(() => {
                                                                const totalSize = diskUsage.Volumes.reduce((sum, vol) => {
                                                                    return sum + (vol.UsageData?.Size || 0);
                                                                }, 0);
                                                                return totalSize > 0 ? formatBytes(totalSize) : '0 B';
                                                            })()}
                                                        </span>
                                                    </div>
                                                    <Progress value={diskUsage.Volumes.length > 0 ? 25 : 0} className="h-2" />
                                                </div>
                                            )}
                                        </div>
                                    ) : null}
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    <TabsContent value="images" className="space-y-4">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle className="flex items-center gap-2">
                                        <Image className="h-5 w-5" />
                                        Docker Images ({images.length})
                                    </CardTitle>
                                    <CardDescription>Manage Docker images</CardDescription>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        onClick={() => handlePruneImages()}
                                        disabled={pruneImagesMutation.isPending || !userPermissions.docker_maintenance_write}
                                    >
                                        {pruneImagesMutation.isPending ? (
                                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                        ) : (
                                            <Trash2 className="mr-2 h-4 w-4" />
                                        )}
                                        Prune Dangling
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => refetchImages()} disabled={isFetchingImages}>
                                        <RefreshCw className={`h-4 w-4 ${isFetchingImages ? 'animate-spin' : ''}`} />
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {isLoadingImages ? (
                                    <LoadingCard />
                                ) : imagesError ? (
                                    <ErrorDisplay error={imagesError} retry={refetchImages} />
                                ) : images.length === 0 ? (
                                    <div className="py-8 text-center">
                                        <Image className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                                        <p className="text-muted-foreground">No images found</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {images.map((image, index) => (
                                            <div
                                                key={image.id || `image-${index}`}
                                                className="flex items-center justify-between rounded-lg border p-3"
                                            >
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate font-medium">
                                                        {image.repo_tags && image.repo_tags.length > 0 && image.repo_tags[0] !== '<none>:<none>'
                                                            ? image.repo_tags[0]
                                                            : 'Untagged Image'}
                                                    </p>
                                                    <p className="text-sm text-muted-foreground">
                                                        {image.id?.substring(7, 19) || 'Unknown'} • {formatBytes(image.size || 0)} •{' '}
                                                        {(() => {
                                                            if (image.created) {
                                                                try {
                                                                    return new Date(image.created * 1000).toLocaleDateString();
                                                                } catch {
                                                                    return 'Unknown';
                                                                }
                                                            }
                                                            return 'Unknown';
                                                        })()}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => image.id && handleDeleteImage(image.id)}
                                                        disabled={
                                                            !image.id || deletingImages.has(image.id) || !userPermissions.docker_maintenance_write
                                                        }
                                                    >
                                                        {image.id && deletingImages.has(image.id) ? (
                                                            <RefreshCw className="h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <Trash2 className="h-4 w-4" />
                                                        )}
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="volumes" className="space-y-4">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle className="flex items-center gap-2">
                                        <Volume className="h-5 w-5" />
                                        Docker Volumes ({volumes.length})
                                    </CardTitle>
                                    <CardDescription>Manage Docker volumes</CardDescription>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        onClick={() => handlePruneVolumes()}
                                        disabled={pruneVolumesMutation.isPending || !userPermissions.docker_maintenance_write}
                                    >
                                        {pruneVolumesMutation.isPending ? (
                                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                        ) : (
                                            <Trash2 className="mr-2 h-4 w-4" />
                                        )}
                                        Prune Unused
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => refetchVolumes()} disabled={isFetchingVolumes}>
                                        <RefreshCw className={`h-4 w-4 ${isFetchingVolumes ? 'animate-spin' : ''}`} />
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {isLoadingVolumes ? (
                                    <LoadingCard />
                                ) : volumesError ? (
                                    <ErrorDisplay error={volumesError} retry={refetchVolumes} />
                                ) : volumes.length === 0 ? (
                                    <div className="py-8 text-center">
                                        <Volume className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                                        <p className="text-muted-foreground">No volumes found</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {volumes.map((volume, index) => (
                                            <div
                                                key={volume.name || `volume-${index}`}
                                                className="flex items-center justify-between rounded-lg border p-3"
                                            >
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate font-medium">{volume.name || 'Unknown'}</p>
                                                    <p className="text-sm text-muted-foreground">
                                                        {volume.driver || 'Unknown'} • {volume.mountpoint || 'Unknown'} •{' '}
                                                        {(() => {
                                                            if (volume.created_at) {
                                                                try {
                                                                    return new Date(volume.created_at).toLocaleDateString();
                                                                } catch {
                                                                    return volume.created_at;
                                                                }
                                                            }
                                                            return 'Unknown';
                                                        })()}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => volume.name && handleDeleteVolume(volume.name)}
                                                        disabled={
                                                            !volume.name ||
                                                            deletingVolumes.has(volume.name) ||
                                                            !userPermissions.docker_maintenance_write
                                                        }
                                                    >
                                                        {volume.name && deletingVolumes.has(volume.name) ? (
                                                            <RefreshCw className="h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <Trash2 className="h-4 w-4" />
                                                        )}
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="networks" className="space-y-4">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle className="flex items-center gap-2">
                                        <Network className="h-5 w-5" />
                                        Docker Networks ({networks.length})
                                    </CardTitle>
                                    <CardDescription>Manage Docker networks</CardDescription>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        onClick={() => handlePruneNetworks()}
                                        disabled={pruneNetworksMutation.isPending || !userPermissions.docker_maintenance_write}
                                    >
                                        {pruneNetworksMutation.isPending ? (
                                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                        ) : (
                                            <Trash2 className="mr-2 h-4 w-4" />
                                        )}
                                        Prune Unused
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => refetchNetworks()} disabled={isFetchingNetworks}>
                                        <RefreshCw className={`h-4 w-4 ${isFetchingNetworks ? 'animate-spin' : ''}`} />
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {isLoadingNetworks ? (
                                    <LoadingCard />
                                ) : networksError ? (
                                    <ErrorDisplay error={networksError} retry={refetchNetworks} />
                                ) : networks.length === 0 ? (
                                    <div className="py-8 text-center">
                                        <Network className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                                        <p className="text-muted-foreground">No networks found</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {networks.map((network, index) => (
                                            <div
                                                key={network.id || `network-${index}`}
                                                className="flex items-center justify-between rounded-lg border p-3"
                                            >
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <p className="truncate font-medium">{network.name || 'Unknown'}</p>
                                                        {network.name && ['bridge', 'host', 'none'].includes(network.name) && (
                                                            <span className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-800">System</span>
                                                        )}
                                                    </div>
                                                    <p className="text-sm text-muted-foreground">
                                                        {network.driver || 'Unknown'} • {network.scope || 'Unknown'} •{' '}
                                                        {(() => {
                                                            if (network.created) {
                                                                try {
                                                                    return new Date(network.created).toLocaleDateString();
                                                                } catch {
                                                                    return network.created;
                                                                }
                                                            }
                                                            return 'Unknown';
                                                        })()}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {network.name && network.id && !['bridge', 'host', 'none'].includes(network.name) && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleDeleteNetwork(network.id)}
                                                            disabled={deletingNetworks.has(network.id) || !userPermissions.docker_maintenance_write}
                                                        >
                                                            {deletingNetworks.has(network.id) ? (
                                                                <RefreshCw className="h-4 w-4 animate-spin" />
                                                            ) : (
                                                                <Trash2 className="h-4 w-4" />
                                                            )}
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="cleanup" className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Zap className="h-5 w-5" />
                                        Build Cache
                                    </CardTitle>
                                    <CardDescription>Clean up Docker build cache</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <Button
                                        onClick={() => handlePruneBuildCache(false)}
                                        disabled={pruneBuildCacheMutation.isPending || !userPermissions.docker_maintenance_write}
                                        className="w-full"
                                    >
                                        {pruneBuildCacheMutation.isPending ? (
                                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                        ) : (
                                            <Trash2 className="mr-2 h-4 w-4" />
                                        )}
                                        Prune Build Cache
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        onClick={() => handlePruneBuildCache(true)}
                                        disabled={pruneBuildCacheMutation.isPending || !userPermissions.docker_maintenance_write}
                                        className="w-full"
                                    >
                                        {pruneBuildCacheMutation.isPending ? (
                                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                        ) : (
                                            <Trash2 className="mr-2 h-4 w-4" />
                                        )}
                                        Prune All Build Cache
                                    </Button>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <AlertTriangle className="h-5 w-5" />
                                        System Prune
                                    </CardTitle>
                                    <CardDescription>Remove all unused Docker objects</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <Button
                                        variant="destructive"
                                        onClick={() => handleSystemPrune(false, false)}
                                        disabled={pruneSystemMutation.isPending || !userPermissions.docker_maintenance_write}
                                        className="w-full"
                                    >
                                        {pruneSystemMutation.isPending ? (
                                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                        ) : (
                                            <Trash2 className="mr-2 h-4 w-4" />
                                        )}
                                        System Prune
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        onClick={() => handleSystemPrune(false, true)}
                                        disabled={pruneSystemMutation.isPending || !userPermissions.docker_maintenance_write}
                                        className="w-full"
                                    >
                                        {pruneSystemMutation.isPending ? (
                                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                        ) : (
                                            <Trash2 className="mr-2 h-4 w-4" />
                                        )}
                                        System Prune + Volumes
                                    </Button>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </AppLayout>
    );
}
