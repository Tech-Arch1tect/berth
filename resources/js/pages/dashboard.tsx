import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDashboardStats } from '@/hooks/queries/use-dashboard-stats';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import type { Server as ServerType } from '@/types/entities';
import { Head, Link, usePage } from '@inertiajs/react';
import { Activity, AlertCircle, ChevronRight, Container, Cpu, Layers3, RefreshCw, Server, Settings } from 'lucide-react';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Dashboard',
        href: '/dashboard',
    },
];

interface Props {
    isAdmin: boolean;
}

export default function Dashboard({ isAdmin }: Props) {
    const { servers } = usePage().props as unknown as { servers: ServerType[] };

    const { data: serverStats = {}, isLoading: isLoadingStats, error: statsError, refetch: refetchStats, isFetching, isStale } = useDashboardStats();

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Dashboard" />

            <div className="space-y-8">
                {/* Header Section */}
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-accent/20">
                            <Layers3 className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
                            <p className="text-muted-foreground">Manage your Docker Compose infrastructure</p>
                        </div>
                        <div className="ml-auto flex items-center gap-2">
                            {isStale && !isFetching && <span className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-600">Stale data</span>}
                            {isFetching && (
                                <span className="flex items-center gap-1 rounded bg-blue-50 px-2 py-1 text-xs text-blue-600">
                                    <RefreshCw className="h-3 w-3 animate-spin" />
                                    Refreshing...
                                </span>
                            )}
                            <Button variant="outline" size="sm" onClick={() => refetchStats()} disabled={isFetching}>
                                <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
                                Refresh
                            </Button>
                        </div>
                    </div>

                    <div className="flex items-center gap-6 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                            <Activity className="h-4 w-4 text-green-500" />
                            <span>
                                {servers.length} server{servers.length !== 1 ? 's' : ''} available
                            </span>
                        </div>

                        {statsError && (
                            <div className="flex items-center gap-2 text-destructive">
                                <AlertCircle className="h-4 w-4" />
                                <span>Failed to load stats</span>
                            </div>
                        )}

                        {!isLoadingStats &&
                            !statsError &&
                            Object.keys(serverStats).length > 0 &&
                            (() => {
                                const totalStacks = Object.values(serverStats).reduce((sum, stats) => sum + stats.total_stacks, 0);
                                const runningStacks = Object.values(serverStats).reduce((sum, stats) => sum + stats.running_stacks, 0);
                                const totalServices = Object.values(serverStats).reduce((sum, stats) => sum + stats.total_services, 0);
                                const runningServices = Object.values(serverStats).reduce((sum, stats) => sum + stats.running_services, 0);
                                const onlineServers = Object.values(serverStats).filter((stats) => stats.status === 'online').length;

                                return (
                                    <>
                                        <div className="flex items-center gap-2">
                                            <Layers3 className="h-4 w-4 text-blue-500" />
                                            <span>
                                                {runningStacks}/{totalStacks} stacks running
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Container className="h-4 w-4 text-orange-500" />
                                            <span>
                                                {runningServices}/{totalServices} services running
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Server className="h-4 w-4 text-purple-500" />
                                            <span>
                                                {onlineServers}/{servers.length} servers online
                                            </span>
                                        </div>
                                    </>
                                );
                            })()}

                        {isLoadingStats && (
                            <div className="flex items-center gap-2">
                                <Cpu className="h-4 w-4 animate-pulse text-muted-foreground" />
                                <span>Loading statistics...</span>
                            </div>
                        )}
                    </div>
                </div>

                {servers.length === 0 ? (
                    <Card className="p-12 text-center">
                        <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-primary/10 to-accent/10">
                            <Server className="h-12 w-12 text-muted-foreground" />
                        </div>
                        <h3 className="mb-3 text-xl font-semibold">No Servers Available</h3>
                    </Card>
                ) : (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-semibold">Your Servers</h2>
                                <p className="text-sm text-muted-foreground">Access and manage your containerised applications</p>
                            </div>
                            {isAdmin && (
                                <Button variant="outline" asChild>
                                    <Link href="/admin/servers">
                                        <Settings className="mr-2 h-4 w-4" />
                                        Manage Servers
                                    </Link>
                                </Button>
                            )}
                        </div>

                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {servers.map((server) => {
                                const stats = serverStats[server.id];
                                const isOffline = stats?.status === 'offline';

                                return (
                                    <Card
                                        key={server.id}
                                        className={`group transition-all duration-200 hover:scale-[1.02] hover:shadow-md ${isOffline ? 'border-destructive/50 bg-destructive/5' : ''}`}
                                    >
                                        <Link href={`/servers/${server.id}/stacks`} className="block">
                                            <CardHeader className="pb-4">
                                                <div className="flex items-start justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div
                                                            className={`flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${isOffline ? 'from-destructive/20 to-destructive/10' : 'from-primary/20 to-accent/20'}`}
                                                        >
                                                            {isOffline ? (
                                                                <AlertCircle className="h-5 w-5 text-destructive" />
                                                            ) : (
                                                                <Server className="h-5 w-5 text-primary" />
                                                            )}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <CardTitle className="truncate text-base transition-colors group-hover:text-primary">
                                                                {server.display_name}
                                                            </CardTitle>
                                                            <p className="mt-1 font-mono text-xs text-muted-foreground">
                                                                {server.https ? 'https' : 'http'}://{server.hostname}:{server.port}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground transition-all group-hover:translate-x-1 group-hover:text-primary" />
                                                </div>
                                            </CardHeader>
                                            <CardContent className="pt-0">
                                                {isOffline ? (
                                                    <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3">
                                                        <div className="flex items-center gap-2 text-destructive">
                                                            <AlertCircle className="h-4 w-4" />
                                                            <span className="text-sm font-medium">Offline</span>
                                                        </div>
                                                        {stats?.error && (
                                                            <p className="mt-1 truncate text-xs text-destructive/80" title={stats.error}>
                                                                {stats.error}
                                                            </p>
                                                        )}
                                                    </div>
                                                ) : stats && !isLoadingStats ? (
                                                    <div className="space-y-3">
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-3">
                                                                <div className="flex items-center gap-2">
                                                                    <Layers3 className="h-4 w-4 text-blue-500" />
                                                                    <div className="min-w-0">
                                                                        <p className="text-xs text-muted-foreground">Stacks</p>
                                                                        <p className="text-sm font-bold text-blue-600">
                                                                            {stats.running_stacks}/{stats.total_stacks}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="rounded-lg border border-green-500/20 bg-green-500/10 p-3">
                                                                <div className="flex items-center gap-2">
                                                                    <Container className="h-4 w-4 text-green-500" />
                                                                    <div className="min-w-0">
                                                                        <p className="text-xs text-muted-foreground">Services</p>
                                                                        <p className="text-sm font-bold text-green-600">
                                                                            {stats.running_services}/{stats.total_services}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center justify-center rounded-lg bg-muted/30 p-3">
                                                        <div className="flex items-center gap-2">
                                                            <Cpu className="h-4 w-4 animate-pulse text-muted-foreground" />
                                                            <span className="text-sm text-muted-foreground">
                                                                {isStale && !isFetching ? 'Stale data' : 'Loading...'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Link>
                                    </Card>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
