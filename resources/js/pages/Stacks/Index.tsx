import SearchAndFilters from '@/components/SearchAndFilters';
import StackCard from '@/components/StackCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useStackFiltering } from '@/hooks/useStackFiltering';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import type { Server, Stack } from '@/types/entities';
import { apiGet } from '@/utils/api';
import { calculateServiceStatusSummary } from '@/utils/stack-utils';
import { Head, router } from '@inertiajs/react';
import { Activity, AlertCircle, Clock, Container, Layers3, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

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
    const [stacks, setStacks] = useState<StackWithLoading[]>(initialStacks.map((stack) => ({ ...stack, isLoadingStatus: true })));
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

    const {
        filteredAndSortedStacks,
        runningStacks,
        totalServices,
        runningServices,
        uniqueStatuses,
        searchTerm,
        sortOption,
        filterStatus,
        setSearchTerm,
        setSortOption,
        setFilterStatus,
        clearFilters,
    } = useStackFiltering(stacks);

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/dashboard' },
        { title: server.display_name, href: `/servers/${server.id}/stacks` },
    ];

    const fetchServiceStatus = useCallback(
        async (
            stackName: string,
        ): Promise<{
            stack: string;
            services: Array<{
                id: string;
                name: string;
                command: string;
                state: string;
                ports: string;
                image: string;
                networks: Array<{
                    name: string;
                    ip_address: string;
                    gateway: string;
                }>;
            }> | null;
        } | null> => {
            try {
                const response = await apiGet(`/api/servers/${server.id}/stacks/${stackName}/status`);
                if (response.success) {
                    return response.data as {
                        stack: string;
                        services: Array<{
                            id: string;
                            name: string;
                            command: string;
                            state: string;
                            ports: string;
                            image: string;
                            networks: Array<{
                                name: string;
                                ip_address: string;
                                gateway: string;
                            }>;
                        }> | null;
                    };
                } else {
                    console.error(`Failed to fetch status for stack ${stackName}:`, response.error);
                }
            } catch (err) {
                console.error(`Failed to fetch status for stack ${stackName}:`, err);
            }
            return null;
        },
        [server.id],
    );

    useEffect(() => {
        const fetchInitialStatus = async () => {
            if (initialStacks.length > 0) {
                setStacks(initialStacks.map((stack) => ({ ...stack, isLoadingStatus: true })));

                for (const stack of initialStacks) {
                    try {
                        const serviceStatus = await fetchServiceStatus(stack.name);
                        const { statusSummary, overallStatus } = calculateServiceStatusSummary(stack, serviceStatus);

                        setStacks((prevStacks) =>
                            prevStacks.map((s) =>
                                s.name === stack.name
                                    ? {
                                          ...s,
                                          service_status: serviceStatus
                                              ? {
                                                    stack: serviceStatus.stack,
                                                    services: serviceStatus.services,
                                                }
                                              : undefined,
                                          service_status_summary: statusSummary,
                                          overall_status: overallStatus,
                                          running_services_count: statusSummary.running,
                                          total_services_count: statusSummary.total,
                                          isLoadingStatus: false,
                                      }
                                    : s,
                            ),
                        );
                    } catch {
                        setStacks((prevStacks) =>
                            prevStacks.map((s) => (s.name === stack.name ? { ...s, isLoadingStatus: false, overall_status: 'unknown' as const } : s)),
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
            onFinish: () => setIsRefreshing(false),
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Stacks - ${server.display_name}`} />

            <div className="space-y-6">
                {/* Header Section */}
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-accent/20">
                            <Layers3 className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold">{server.display_name} Stacks</h1>
                            <p className="font-mono text-sm text-muted-foreground">
                                {server.https ? 'https' : 'http'}://{server.hostname}:{server.port}
                            </p>
                        </div>
                    </div>
                    <Button onClick={refreshStacks} disabled={isRefreshing} size="lg" className="gap-2">
                        <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>

                {/* Stats Overview */}
                {stacks.length > 0 && (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 shadow-sm">
                            <CardContent className="p-5">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-muted-foreground">Total Stacks</p>
                                        <p className="text-3xl font-bold">{filteredAndSortedStacks.length}</p>
                                    </div>
                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                                        <Layers3 className="h-5 w-5 text-primary" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="border-green-500/20 bg-gradient-to-br from-green-500/5 to-green-500/10 shadow-sm">
                            <CardContent className="p-5">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-muted-foreground">Running</p>
                                        <p className="text-3xl font-bold text-green-600">{runningStacks}</p>
                                    </div>
                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                                        <Activity className="h-5 w-5 text-green-500" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="border-orange-500/20 bg-gradient-to-br from-orange-500/5 to-orange-500/10 shadow-sm">
                            <CardContent className="p-5">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-muted-foreground">Services</p>
                                        <p className="text-3xl font-bold">
                                            <span className="text-orange-600">{runningServices}</span>
                                            <span className="text-muted-foreground">/{totalServices}</span>
                                        </p>
                                    </div>
                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10">
                                        <Container className="h-5 w-5 text-orange-500" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-purple-500/10 shadow-sm">
                            <CardContent className="p-5">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-muted-foreground">Last Updated</p>
                                        <p className="text-lg font-semibold">{lastRefresh.toLocaleTimeString()}</p>
                                    </div>
                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
                                        <Clock className="h-5 w-5 text-purple-500" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {stacks.length > 0 && (
                    <SearchAndFilters
                        searchTerm={searchTerm}
                        sortOption={sortOption}
                        filterStatus={filterStatus}
                        uniqueStatuses={uniqueStatuses}
                        onSearchChange={setSearchTerm}
                        onSortChange={setSortOption}
                        onStatusFilterChange={setFilterStatus}
                    />
                )}

                {/* Error State */}
                {error && (
                    <Card className="border-destructive/50 bg-destructive/5">
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-3">
                                <AlertCircle className="h-5 w-5 text-destructive" />
                                <span className="font-medium text-destructive">{error}</span>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Empty State */}
                {filteredAndSortedStacks.length === 0 && !error ? (
                    <Card className="p-12 text-center">
                        <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-primary/10 to-accent/10">
                            <Container className="h-12 w-12 text-muted-foreground" />
                        </div>
                        <h3 className="mb-3 text-xl font-semibold">No Stacks Found</h3>
                        <p className="mx-auto mb-6 max-w-md text-muted-foreground">
                            {searchTerm || filterStatus !== 'all'
                                ? 'No stacks match your current filters. Try adjusting your search or filters.'
                                : 'No Docker Compose stacks are currently running on this server. Deploy some containers to get started.'}
                        </p>
                        <div className="flex justify-center gap-3">
                            <Button onClick={refreshStacks} variant="outline">
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Refresh
                            </Button>
                            <Button variant="secondary" onClick={clearFilters}>
                                Clear Filters
                            </Button>
                        </div>
                    </Card>
                ) : (
                    <div className="space-y-6">
                        {filteredAndSortedStacks.map((stack) => (
                            <StackCard key={stack.name} stack={stack} server={server} />
                        ))}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
