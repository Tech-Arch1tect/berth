import { useState, useEffect } from 'react';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Server, Container, Activity, Layers3, ChevronRight, Settings, AlertCircle, Cpu } from 'lucide-react';
import type { Server as ServerType } from '@/types/entities';
import { apiGet } from '@/utils/api';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Dashboard',
        href: '/dashboard',
    },
];

interface ServerStats {
    total_stacks: number;
    running_stacks: number;
    total_services: number;
    running_services: number;
    status: 'online' | 'offline';
    error?: string;
}

interface Props {
    isAdmin: boolean;
}

export default function Dashboard({ isAdmin }: Props) {
    const { servers } = usePage().props as unknown as { servers: ServerType[] };
    const [serverStats, setServerStats] = useState<Record<number, ServerStats>>({});
    const [isLoadingStats, setIsLoadingStats] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const response = await apiGet('/api/dashboard/stats');
                if (response.success) {
                    setServerStats(response.data as Record<number, ServerStats>);
                }
            } catch (error) {
                console.error('Failed to fetch dashboard stats:', error);
            } finally {
                setIsLoadingStats(false);
            }
        };

        fetchStats();
    }, []);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Dashboard" />
            
            <div className="space-y-8">
                {/* Header Section */}
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-primary/20 to-accent/20 rounded-xl flex items-center justify-center">
                            <Layers3 className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">
                                Dashboard
                            </h1>
                            <p className="text-muted-foreground">
                                Manage your Docker Compose infrastructure
                            </p>
                        </div>
                    </div>

                    {/* Stats Bar */}
                    <div className="flex items-center gap-6 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                            <Activity className="h-4 w-4 text-green-500" />
                            <span>{servers.length} server{servers.length !== 1 ? 's' : ''} available</span>
                        </div>
                        {!isLoadingStats && Object.keys(serverStats).length > 0 && (() => {
                            const totalStacks = Object.values(serverStats).reduce((sum, stats) => sum + stats.total_stacks, 0);
                            const runningStacks = Object.values(serverStats).reduce((sum, stats) => sum + stats.running_stacks, 0);
                            const totalServices = Object.values(serverStats).reduce((sum, stats) => sum + stats.total_services, 0);
                            const runningServices = Object.values(serverStats).reduce((sum, stats) => sum + stats.running_services, 0);
                            const onlineServers = Object.values(serverStats).filter(stats => stats.status === 'online').length;
                            
                            return (
                                <>
                                    <div className="flex items-center gap-2">
                                        <Layers3 className="h-4 w-4 text-blue-500" />
                                        <span>{runningStacks}/{totalStacks} stacks running</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Container className="h-4 w-4 text-orange-500" />
                                        <span>{runningServices}/{totalServices} services running</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Server className="h-4 w-4 text-purple-500" />
                                        <span>{onlineServers}/{servers.length} servers online</span>
                                    </div>
                                </>
                            );
                        })()}
                        {isLoadingStats && (
                            <div className="flex items-center gap-2">
                                <Cpu className="h-4 w-4 text-muted-foreground animate-pulse" />
                                <span>Loading statistics...</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Main Content */}
                {servers.length === 0 ? (
                    <Card className="p-12 text-center">
                        <div className="mx-auto w-24 h-24 bg-gradient-to-br from-primary/10 to-accent/10 rounded-full flex items-center justify-center mb-6">
                            <Server className="h-12 w-12 text-muted-foreground" />
                        </div>
                        <h3 className="text-xl font-semibold mb-3">No Servers Available</h3>
                    </Card>
                ) : (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-semibold">Your Servers</h2>
                                <p className="text-sm text-muted-foreground">
                                    Access and manage your containerised applications
                                </p>
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
                                        className={`group hover:shadow-md transition-all duration-200 hover:scale-[1.02] ${isOffline ? 'border-destructive/50 bg-destructive/5' : ''}`}
                                    >
                                        <Link href={`/servers/${server.id}/stacks`} className="block">
                                            <CardHeader className="pb-4">
                                                <div className="flex items-start justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-10 h-10 bg-gradient-to-br rounded-lg flex items-center justify-center ${isOffline ? 'from-destructive/20 to-destructive/10' : 'from-primary/20 to-accent/20'}`}>
                                                            {isOffline ? (
                                                                <AlertCircle className="h-5 w-5 text-destructive" />
                                                            ) : (
                                                                <Server className="h-5 w-5 text-primary" />
                                                            )}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <CardTitle className="text-base group-hover:text-primary transition-colors truncate">
                                                                {server.display_name}
                                                            </CardTitle>
                                                            <p className="text-xs text-muted-foreground font-mono mt-1">
                                                                {server.https ? "https" : "http"}://{server.hostname}:{server.port}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all flex-shrink-0" />
                                                </div>
                                            </CardHeader>
                                            <CardContent className="pt-0">
                                                {isOffline ? (
                                                    <div className="p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                                                        <div className="flex items-center gap-2 text-destructive">
                                                            <AlertCircle className="h-4 w-4" />
                                                            <span className="text-sm font-medium">Offline</span>
                                                        </div>
                                                        {stats?.error && (
                                                            <p className="text-xs text-destructive/80 mt-1 truncate" title={stats.error}>
                                                                {stats.error}
                                                            </p>
                                                        )}
                                                    </div>
                                                ) : stats && !isLoadingStats ? (
                                                    <div className="space-y-3">
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
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
                                                            <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/20">
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
                                                    <div className="flex items-center justify-center p-3 bg-muted/30 rounded-lg">
                                                        <div className="flex items-center gap-2">
                                                            <Cpu className="h-4 w-4 text-muted-foreground animate-pulse" />
                                                            <span className="text-sm text-muted-foreground">Loading...</span>
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
