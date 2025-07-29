import SearchAndFilters from '@/components/SearchAndFilters';
import StackCard from '@/components/StackCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useRefreshStacks } from '@/hooks/mutations/use-stack-mutations';
import { useServerStacks } from '@/hooks/queries/use-server-stacks';
import { useStackFiltering } from '@/hooks/useStackFiltering';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import type { Server } from '@/types/entities';
import { Head, Link } from '@inertiajs/react';
import { Activity, AlertCircle, Clock, Container, HardDrive, Layers3, RefreshCw } from 'lucide-react';
import { useState } from 'react';

interface UserPermissions {
    read: boolean;
    write: boolean;
    'start-stop': boolean;
}

interface Props {
    server: Server;
    error?: string;
    userPermissions: UserPermissions;
}

export default function StacksIndex({ server, error }: Props) {
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

    const { data: stacks = [], isLoading } = useServerStacks(server.id, true);
    const refreshStacksMutation = useRefreshStacks(server.id);

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

    const refreshStacks = async () => {
        setLastRefresh(new Date());
        try {
            await refreshStacksMutation.mutateAsync();
        } catch (error) {
            console.error('Failed to refresh stacks:', error);
        }
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
                    <div className="flex gap-2">
                        <Button asChild variant="outline" size="lg" className="gap-2">
                            <Link href={`/servers/${server.id}/docker`}>
                                <HardDrive className="h-4 w-4" />
                                Docker Maintenance
                            </Link>
                        </Button>
                        <Button onClick={refreshStacks} disabled={refreshStacksMutation.isPending || isLoading} size="lg" className="gap-2">
                            <RefreshCw className={`h-4 w-4 ${refreshStacksMutation.isPending || isLoading ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                    </div>
                </div>

                {/* Stats Overview */}
                {stacks && stacks.length > 0 && !isLoading && (
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

                {stacks && stacks.length > 0 && !isLoading && (
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

                {/* Loading State */}
                {(isLoading || refreshStacksMutation.isPending) && !stacks.length ? (
                    <Card className="p-12 text-center">
                        <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-primary/10 to-accent/10">
                            <RefreshCw className="h-12 w-12 animate-spin text-muted-foreground" />
                        </div>
                        <h3 className="mb-3 text-xl font-semibold">Loading Stacks</h3>
                        <p className="mx-auto max-w-md text-muted-foreground">Fetching Docker Compose stacks from {server.display_name}...</p>
                    </Card>
                ) : null}

                {/* Empty State */}
                {filteredAndSortedStacks.length === 0 && !error && !isLoading ? (
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
