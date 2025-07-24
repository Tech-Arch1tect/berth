import { useState, useEffect, useCallback } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Container, Network, HardDrive, ExternalLink, AlertCircle, Activity, Clock, Layers3, Loader2 } from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import StackStatusBadge from '@/components/StackStatusBadge';
import type { Server, Stack } from '@/types/entities';
import { calculateServiceStatusSummary, findServiceStatus } from '@/utils/stack-utils';
import { apiGet } from '@/utils/api';
import { type BreadcrumbItem } from '@/types';

interface UserPermissions {
    read: boolean;
    write: boolean;
    'start-stop': boolean;
}

interface StackWithLoading extends Stack {
    isLoadingStatus?: boolean;
}

interface Props {
    server: Server;
    stacks: Stack[];
    error?: string;
    userPermissions: UserPermissions;
    isAdmin?: boolean;
}

export default function StacksIndex({ server, stacks: initialStacks, error }: Props) {
    const [stacks, setStacks] = useState<StackWithLoading[]>(initialStacks.map(stack => ({ ...stack, isLoadingStatus: true })));
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/dashboard' },
        { title: server.display_name, href: `/servers/${server.id}/stacks` },
    ];

    const fetchServiceStatus = useCallback(async (stackName: string): Promise<{
        stack: string;
        services: Array<{
            name: string;
            command: string;
            state: string;
            ports: string;
        }> | null;
    } | null> => {
        try {
            const response = await apiGet(`/api/servers/${server.id}/stacks/${stackName}/status`);
            if (response.success) {
                return response.data as {
                    stack: string;
                    services: Array<{
                        name: string;
                        command: string;
                        state: string;
                        ports: string;
                    }> | null;
                };
            } else {
                console.error(`Failed to fetch status for stack ${stackName}:`, response.error);
            }
        } catch (err) {
            console.error(`Failed to fetch status for stack ${stackName}:`, err);
        }
        return null;
    }, [server.id]);

    useEffect(() => {
        const fetchInitialStatus = async () => {
            if (initialStacks.length > 0) {
                setStacks(initialStacks.map(stack => ({ ...stack, isLoadingStatus: true })));
                
                for (const stack of initialStacks) {
                    try {
                        const serviceStatus = await fetchServiceStatus(stack.name);
                        const { statusSummary, overallStatus } = calculateServiceStatusSummary(stack, serviceStatus);
                        
                        setStacks(prevStacks => 
                            prevStacks.map(s => 
                                s.name === stack.name 
                                    ? { 
                                        ...s, 
                                        service_status: serviceStatus ? {
                                            stack: serviceStatus.stack,
                                            services: serviceStatus.services
                                        } : undefined,
                                        service_status_summary: statusSummary,
                                        overall_status: overallStatus,
                                        running_services_count: statusSummary.running,
                                        total_services_count: statusSummary.total,
                                        isLoadingStatus: false
                                    }
                                    : s
                            )
                        );
                    } catch {
                        setStacks(prevStacks => 
                            prevStacks.map(s => 
                                s.name === stack.name 
                                    ? { ...s, isLoadingStatus: false, overall_status: 'unknown' as const }
                                    : s
                            )
                        );
                    }
                }
            }
        };

        fetchInitialStatus();
    }, [initialStacks, fetchServiceStatus]);

    const refreshStacks = () => {
        setIsRefreshing(true);
        setLastRefresh(new Date());
        router.reload({
            onFinish: () => setIsRefreshing(false)
        });
    };


    const loadedStacks = stacks.filter(stack => !stack.isLoadingStatus);
    const runningStacks = loadedStacks.filter(stack => stack.overall_status === 'running').length;
    const totalServices = stacks.reduce((acc, stack) => acc + (stack.service_status_summary?.total || stack.service_count), 0);
    const runningServices = stacks.reduce((acc, stack) => acc + (stack.service_status_summary?.running || 0), 0);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Stacks - ${server.display_name}`} />
            
            <div className="space-y-6">
                {/* Header Section */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-primary/20 to-accent/20 rounded-lg flex items-center justify-center">
                            <Layers3 className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold">
                                {server.display_name} Stacks
                            </h1>
                            <p className="text-sm text-muted-foreground font-mono">
                                {server.https ? "https" : "http"}://{server.hostname}:{server.port}
                            </p>
                        </div>
                    </div>
                    <Button
                        onClick={refreshStacks}
                        disabled={isRefreshing}
                        variant="outline"
                    >
                        <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>

                {/* Stats Overview */}
                {stacks.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center">
                                        <Layers3 className="h-4 w-4 text-blue-500" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Total Stacks</p>
                                        <p className="text-2xl font-bold">{stacks.length}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-green-500/10 rounded-lg flex items-center justify-center">
                                        <Activity className="h-4 w-4 text-green-500" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Running</p>
                                        <p className="text-2xl font-bold text-green-500">{runningStacks}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-orange-500/10 rounded-lg flex items-center justify-center">
                                        <Container className="h-4 w-4 text-orange-500" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Services</p>
                                        <p className="text-2xl font-bold">{runningServices}<span className="text-sm text-muted-foreground">/{totalServices}</span></p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-purple-500/10 rounded-lg flex items-center justify-center">
                                        <Clock className="h-4 w-4 text-purple-500" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Last Updated</p>
                                        <p className="text-sm font-medium">{lastRefresh.toLocaleTimeString()}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* Error State */}
                {error && (
                    <Card className="border-destructive/50 bg-destructive/5">
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-3">
                                <AlertCircle className="h-5 w-5 text-destructive" />
                                <span className="text-destructive font-medium">{error}</span>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Empty State */}
                {stacks.length === 0 && !error ? (
                    <Card className="p-12 text-center">
                        <div className="mx-auto w-24 h-24 bg-gradient-to-br from-primary/10 to-accent/10 rounded-full flex items-center justify-center mb-6">
                            <Container className="h-12 w-12 text-muted-foreground" />
                        </div>
                        <h3 className="text-xl font-semibold mb-3">No Stacks Found</h3>
                        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                            No Docker Compose stacks are currently running on this server. 
                            Deploy some containers to get started.
                        </p>
                        <Button onClick={refreshStacks} variant="outline">
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Refresh
                        </Button>
                    </Card>
                ) : (
                    <div className="space-y-6">
                        {stacks.map((stack) => (
                            <Card key={stack.name} className="group hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border-border/30 bg-gradient-to-br from-card via-card to-muted/20 backdrop-blur-sm">
                                <Link href={`/servers/${server.id}/stacks/${stack.name}`} className="block">
                                    <CardHeader className="pb-6">
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-gradient-to-br from-primary/20 to-accent/20 rounded-lg flex items-center justify-center">
                                                    <Container className="h-5 w-5 text-primary" />
                                                </div>
                                                <div>
                                                    <CardTitle className="text-lg group-hover:text-primary transition-colors flex items-center gap-3">
                                                        {stack.name}
                                                        <StackStatusBadge stack={stack} />
                                                    </CardTitle>
                                                    <p className="text-sm text-muted-foreground font-mono mt-1">
                                                        {stack.path}
                                                    </p>
                                                </div>
                                            </div>
                                            <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                        </div>
                                    </CardHeader>
                                                <CardContent className="pt-2">
                                                    <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-8">
                                                        {/* Services */}
                                                        <div className="space-y-3">
                                                            <div className="flex items-center gap-2">
                                                                <Container className="h-4 w-4 text-primary" />
                                                                <span className="text-sm font-semibold">
                                                                    Services ({stack.service_count})
                                                                </span>
                                                                {stack.service_status_summary && (
                                                                    <Badge variant="outline" className="text-xs">
                                                                        {stack.service_status_summary.running}/{stack.service_status_summary.total} running
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                            <div className="space-y-2">
                                                                {stack.service_names.slice(0, 3).map((service) => {
                                                                    const serviceStatus = findServiceStatus(stack, service);
                                                                    const isRunning = serviceStatus?.state === 'running';
                                                                    const displayState = serviceStatus?.state || (stack.isLoadingStatus ? 'loading' : 'stopped');
                                                                    const serviceConfig = stack.services[service];
                                                                    const imageName = serviceConfig?.image || 'Unknown';
                                                                    
                                                                    return (
                                                                        <div key={service} className="p-3 bg-gradient-to-r from-muted/40 to-muted/20 rounded-xl border border-border/30 space-y-2">
                                                                            <div className="flex items-center justify-between">
                                                                                <span className="text-sm font-medium truncate">{service}</span>
                                                                                {stack.isLoadingStatus ? (
                                                                                    <Badge variant="outline" className="text-xs bg-muted/50">
                                                                                        <Loader2 className="h-2.5 w-2.5 mr-1 animate-spin" />
                                                                                        Loading
                                                                                    </Badge>
                                                                                ) : (
                                                                                    <Badge 
                                                                                        variant={isRunning ? 'default' : 'outline'}
                                                                                        className={`text-xs ${isRunning ? 'bg-green-500/10 text-green-700 border-green-500/30 dark:text-green-400' : 'bg-red-500/10 text-red-700 border-red-500/30 dark:text-red-400'}`}
                                                                                    >
                                                                                        {displayState}
                                                                                    </Badge>
                                                                                )}
                                                                            </div>
                                                                            <div className="text-xs text-muted-foreground font-mono truncate" title={imageName}>
                                                                                {imageName}
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                                {stack.service_names.length > 3 && (
                                                                    <p className="text-xs text-muted-foreground text-center py-2">
                                                                        +{stack.service_names.length - 3} more services...
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Port Mappings */}
                                                        <div className="space-y-3">
                                                            <div className="flex items-center gap-2">
                                                                <Network className="h-4 w-4 text-blue-500" />
                                                                <span className="text-sm font-semibold">
                                                                    Ports ({stack.port_mappings.length})
                                                                </span>
                                                            </div>
                                                            <div className="space-y-2">
                                                                {stack.port_mappings.slice(0, 3).map((port, index) => (
                                                                    <div key={index} className="flex items-center justify-between p-3 bg-gradient-to-r from-muted/40 to-muted/20 rounded-xl border border-border/30">
                                                                        <span className="text-sm font-mono">{port.published}:{port.target}</span>
                                                                        <Badge variant="outline" className="text-xs">
                                                                            {port.protocol}
                                                                        </Badge>
                                                                    </div>
                                                                ))}
                                                                {stack.port_mappings.length > 3 && (
                                                                    <p className="text-xs text-muted-foreground text-center py-2">
                                                                        +{stack.port_mappings.length - 3} more ports...
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Volume Mappings */}
                                                        <div className="space-y-3">
                                                            <div className="flex items-center gap-2">
                                                                <HardDrive className="h-4 w-4 text-orange-500" />
                                                                <span className="text-sm font-semibold">
                                                                    Volumes ({stack.volume_mappings.length})
                                                                </span>
                                                            </div>
                                                            <div className="space-y-2">
                                                                {stack.volume_mappings.slice(0, 2).map((volume, index) => (
                                                                    <div key={index} className="flex items-center justify-between p-3 bg-gradient-to-r from-muted/40 to-muted/20 rounded-xl border border-border/30">
                                                                        <div className="text-sm font-mono truncate">
                                                                            <span className="text-muted-foreground">{volume.source?.split('/').pop()}</span>
                                                                            <span className="mx-2">→</span>
                                                                            <span>{volume.target?.split('/').pop()}</span>
                                                                        </div>
                                                                        {volume.read_only && (
                                                                            <Badge variant="outline" className="text-xs">RO</Badge>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                                {stack.volume_mappings.length > 2 && (
                                                                    <p className="text-xs text-muted-foreground text-center py-2">
                                                                        +{stack.volume_mappings.length - 2} more volumes...
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                    </CardContent>
                                </Link>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}