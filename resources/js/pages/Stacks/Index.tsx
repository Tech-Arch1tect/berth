import { useState, useEffect } from 'react';
import { Head, Link } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, RefreshCw, Container, Network, HardDrive, ExternalLink, AlertCircle } from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import StackStatusBadge from '@/components/StackStatusBadge';
import type { Server, Stack } from '@/types/entities';
import { calculateServiceStatusSummary, findServiceStatus } from '@/utils/stack-utils';

interface UserPermissions {
    read: boolean;
    write: boolean;
    'start-stop': boolean;
}

interface Props {
    server: Server;
    stacks: Stack[];
    error?: string;
    userPermissions: UserPermissions;
    isAdmin?: boolean;
}

export default function StacksIndex({ server, stacks: initialStacks, error, userPermissions, isAdmin = false }: Props) {
    const [stacks, setStacks] = useState<Stack[]>(initialStacks);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

    // Fetch service status for initial stacks on component mount
    useEffect(() => {
        const fetchInitialStatus = async () => {
            if (initialStacks.length > 0) {
                setIsRefreshing(true);
                const stacksWithStatus = await Promise.all(
                    initialStacks.map(async (stack) => {
                        const serviceStatus = await fetchServiceStatus(stack.name);
                        
                        // Calculate status summary
                        const { statusSummary, overallStatus } = calculateServiceStatusSummary(stack, serviceStatus);
                        
                        return { 
                            ...stack, 
                            service_status: serviceStatus,
                            service_status_summary: statusSummary,
                            overall_status: overallStatus,
                            running_services_count: statusSummary.running,
                            total_services_count: statusSummary.total
                        };
                    })
                );
                setStacks(stacksWithStatus);
                setIsRefreshing(false);
            }
        };

        fetchInitialStatus();
    }, []);

    const fetchServiceStatus = async (stackName: string) => {
        try {
            const response = await fetch(`/api/servers/${server.id}/stacks/${stackName}/status`);
            if (response.ok) {
                return await response.json();
            }
        } catch (err) {
            console.error(`Failed to fetch status for stack ${stackName}:`, err);
        }
        return null;
    };

    const refreshStacks = async () => {
        setIsRefreshing(true);
        try {
            const response = await fetch(`/servers/${server.id}/stacks/refresh`);
            const data = await response.json();
            
            if (response.ok) {
                // Fetch service status for each stack
                const stacksWithStatus = await Promise.all(
                    data.stacks.map(async (stack: Stack) => {
                        const serviceStatus = await fetchServiceStatus(stack.name);
                        
                        // Calculate status summary
                        const { statusSummary, overallStatus } = calculateServiceStatusSummary(stack, serviceStatus);
                        
                        return { 
                            ...stack, 
                            service_status: serviceStatus,
                            service_status_summary: statusSummary,
                            overall_status: overallStatus,
                            running_services_count: statusSummary.running,
                            total_services_count: statusSummary.total
                        };
                    })
                );
                
                setStacks(stacksWithStatus);
                setLastRefresh(new Date());
            } else {
                console.error('Failed to refresh stacks:', data.error);
            }
        } catch (err) {
            console.error('Failed to refresh stacks:', err);
        } finally {
            setIsRefreshing(false);
        }
    };


    return (
        <AppLayout>
            <Head title={`Stacks - ${server.display_name}`} />
            
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <Link href={isAdmin ? "/admin/servers" : "/dashboard"}>
                        <Button variant="ghost" size="sm">
                            <ArrowLeft size={16} />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <Container size={24} />
                            Docker Stacks - {server.display_name}
                        </h1>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            {server.https ? "https" : "http"}://{server.hostname}:{server.port}
                        </p>
                    </div>
                </div>

                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <h2 className="text-lg font-semibold">
                            Compose Stacks ({stacks.length})
                        </h2>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                            Last updated: {lastRefresh.toLocaleTimeString()}
                        </span>
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

                {error && (
                    <Card className="border-red-200 dark:border-red-800">
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                                <AlertCircle size={20} />
                                <span>{error}</span>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {stacks.length === 0 && !error ? (
                    <Card>
                        <CardContent className="text-center py-8">
                            <Container className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                                No stacks found
                            </h3>
                            <p className="text-gray-600 dark:text-gray-400 mb-4">
                                No Docker Compose stacks are currently running on this server.
                            </p>
                            <Button onClick={refreshStacks} variant="outline">
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Refresh
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-4">
                        {stacks.map((stack) => {
                            return (
                                <Card key={stack.name} className="hover:shadow-md transition-shadow">
                                    <CardHeader>
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <CardTitle className="flex items-center gap-2">
                                                    {stack.name}
                                                    <StackStatusBadge stack={stack} />
                                                </CardTitle>
                                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                                    {stack.path}
                                                </p>
                                            </div>
                                            <div className="space-x-2">
                                                <Link href={`/servers/${server.id}/stacks/${stack.name}`}>
                                                    <Button variant="outline" size="sm">
                                                        <ExternalLink size={16} />
                                                    </Button>
                                                </Link>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            {/* Services */}
                                            <div>
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Container size={16} />
                                                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                                        Services ({stack.service_count})
                                                        {stack.service_status_summary && (
                                                            <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                                                                {stack.service_status_summary.running}/{stack.service_status_summary.total} running
                                                            </span>
                                                        )}
                                                    </span>
                                                </div>
                                                <div className="space-y-1">
                                                    {stack.service_names.slice(0, 3).map((service) => {
                                                        // Find status for this service using utility function
                                                        const serviceStatus = findServiceStatus(stack, service);
                                                        const isRunning = serviceStatus?.state === 'running';
                                                        const displayState = serviceStatus?.state || 'stopped';
                                                        
                                                        return (
                                                            <div key={service} className="flex items-center gap-2">
                                                                <div className="text-xs text-gray-600 dark:text-gray-400">
                                                                    {service}
                                                                </div>
                                                                <Badge 
                                                                    variant={isRunning ? 'default' : 'outline'}
                                                                    className="h-4 text-xs"
                                                                >
                                                                    {displayState}
                                                                </Badge>
                                                            </div>
                                                        );
                                                    })}
                                                    {stack.service_names.length > 3 && (
                                                        <div className="text-xs text-gray-500 dark:text-gray-400">
                                                            +{stack.service_names.length - 3} more...
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Port Mappings */}
                                            <div>
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Network size={16} />
                                                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                                        Ports ({stack.port_mappings.length})
                                                    </span>
                                                </div>
                                                <div className="space-y-1">
                                                    {stack.port_mappings.slice(0, 3).map((port, index) => (
                                                        <div key={index} className="text-xs text-gray-600 dark:text-gray-400">
                                                            {port.published}:{port.target} ({port.protocol})
                                                        </div>
                                                    ))}
                                                    {stack.port_mappings.length > 3 && (
                                                        <div className="text-xs text-gray-500 dark:text-gray-400">
                                                            +{stack.port_mappings.length - 3} more...
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Volume Mappings */}
                                            <div>
                                                <div className="flex items-center gap-2 mb-2">
                                                    <HardDrive size={16} />
                                                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                                        Volumes ({stack.volume_mappings.length})
                                                    </span>
                                                </div>
                                                <div className="space-y-1">
                                                    {stack.volume_mappings.slice(0, 2).map((volume, index) => (
                                                        <div key={index} className="text-xs text-gray-600 dark:text-gray-400">
                                                            {volume.source?.split('/').pop()} → {volume.target?.split('/').pop()}
                                                            {volume.read_only && ' (RO)'}
                                                        </div>
                                                    ))}
                                                    {stack.volume_mappings.length > 2 && (
                                                        <div className="text-xs text-gray-500 dark:text-gray-400">
                                                            +{stack.volume_mappings.length - 2} more...
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}