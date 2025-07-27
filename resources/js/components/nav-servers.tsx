import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem } from '@/components/ui/sidebar';
import type { Server as ServerType, Stack } from '@/types/entities';
import { apiGet } from '@/utils/api';
import { calculateServiceStatusSummary } from '@/utils/stack-utils';
import { Link } from '@inertiajs/react';
import { Activity, AlertCircle, ChevronRight, Container, HardDrive, Layers3, Loader2, Server } from 'lucide-react';
import { useEffect, useState } from 'react';

interface ServerStats {
    total_stacks: number;
    running_stacks: number;
    total_services: number;
    running_services: number;
    status: 'online' | 'offline';
    error?: string;
}

interface StackWithStatus {
    name: string;
    service_count: number;
    overall_status?: 'running' | 'stopped' | 'partial' | 'unknown';
}

interface NavServersProps {
    servers: ServerType[];
}

export function NavServers({ servers }: NavServersProps) {
    const [serverStats, setServerStats] = useState<Record<number, ServerStats>>({});
    const [serverStacks, setServerStacks] = useState<Record<number, StackWithStatus[]>>({});
    const [isLoadingStats, setIsLoadingStats] = useState(true);
    const [loadingStacks, setLoadingStacks] = useState<Set<number>>(new Set());
    const [expandedServers, setExpandedServers] = useState<Set<number>>(new Set());

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const response = await apiGet('/api/dashboard/stats');
                if (response.success) {
                    setServerStats(response.data as Record<number, ServerStats>);
                }
            } catch (error) {
                console.error('Failed to fetch server stats:', error);
            } finally {
                setIsLoadingStats(false);
            }
        };

        fetchStats();
    }, []);

    const fetchServerStacks = async (serverId: number) => {
        if (serverStacks[serverId]) return;

        setLoadingStacks((prev) => new Set(prev).add(serverId));

        try {
            const response = await apiGet(`/api/servers/${serverId}/stacks`);
            if (response.success) {
                const stacks = (response.data as { stacks: StackWithStatus[] }).stacks;

                const stacksWithStatus = await Promise.all(
                    stacks.map(async (stack: StackWithStatus) => {
                        try {
                            const statusResponse = await apiGet(`/api/servers/${serverId}/stacks/${stack.name}/status`);
                            if (statusResponse.success) {
                                const serviceStatus = statusResponse.data as {
                                    stack: string;
                                    services: Array<{
                                        name: string;
                                        command: string;
                                        state: string;
                                        ports: string;
                                    }> | null;
                                };

                                const stackForCalc = {
                                    name: stack.name,
                                    service_count: stack.service_count || 0,
                                } as Pick<Stack, 'name' | 'service_count'>;

                                const { overallStatus } = calculateServiceStatusSummary(stackForCalc as Stack, serviceStatus);

                                return {
                                    name: stack.name,
                                    service_count: stack.service_count || 0,
                                    overall_status: overallStatus,
                                };
                            }
                        } catch (statusError) {
                            console.error(`Failed to fetch status for stack ${stack.name}:`, statusError);
                        }

                        return {
                            name: stack.name,
                            service_count: stack.service_count || 0,
                            overall_status: 'unknown' as const,
                        };
                    }),
                );

                setServerStacks((prev) => ({
                    ...prev,
                    [serverId]: stacksWithStatus,
                }));
            }
        } catch (error) {
            console.error(`Failed to fetch stacks for server ${serverId}:`, error);
        } finally {
            setLoadingStacks((prev) => {
                const newSet = new Set(prev);
                newSet.delete(serverId);
                return newSet;
            });
        }
    };

    const toggleServer = (serverId: number) => {
        const newExpanded = new Set(expandedServers);
        if (newExpanded.has(serverId)) {
            newExpanded.delete(serverId);
        } else {
            newExpanded.add(serverId);
            fetchServerStacks(serverId);
        }
        setExpandedServers(newExpanded);
    };

    return (
        <SidebarMenu className="overflow-x-hidden">
            {servers.map((server) => {
                const stats = serverStats[server.id];
                const stacks = serverStacks[server.id] || [];
                const isExpanded = expandedServers.has(server.id);
                const isOffline = stats?.status === 'offline';
                const isLoadingServerStacks = loadingStacks.has(server.id);

                return (
                    <Collapsible key={server.id} open={isExpanded} onOpenChange={() => toggleServer(server.id)}>
                        <SidebarMenuItem>
                            <CollapsibleTrigger asChild>
                                <SidebarMenuButton
                                    tooltip={`${server.display_name} - ${server.hostname}:${server.port}`}
                                    className="group w-full overflow-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                                >
                                    <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
                                        {isOffline ? (
                                            <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
                                        ) : (
                                            <Server className="h-4 w-4 shrink-0" />
                                        )}
                                        <span className="min-w-0 flex-1 truncate">{server.display_name}</span>
                                    </div>
                                    <div className="flex min-w-0 shrink-0 items-center gap-1">
                                        {isLoadingStats ? (
                                            <Loader2 className="h-3 w-3 flex-shrink-0 animate-spin text-muted-foreground" />
                                        ) : stats && !isOffline ? (
                                            <div className="flex min-w-0 items-center gap-1 overflow-hidden">
                                                <Badge
                                                    variant="outline"
                                                    className="h-4 flex-shrink-0 overflow-hidden px-1 py-0 text-xs whitespace-nowrap"
                                                >
                                                    {stats.running_stacks}/{stats.total_stacks}
                                                </Badge>
                                                <Badge
                                                    variant="outline"
                                                    className="h-4 flex-shrink-0 overflow-hidden px-1 py-0 text-xs whitespace-nowrap"
                                                >
                                                    {stats.running_services}/{stats.total_services}
                                                </Badge>
                                            </div>
                                        ) : isOffline ? (
                                            <Badge variant="destructive" className="h-4 flex-shrink-0 px-1 py-0 text-xs whitespace-nowrap">
                                                Offline
                                            </Badge>
                                        ) : null}
                                        <ChevronRight className={`h-3 w-3 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                    </div>
                                </SidebarMenuButton>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                                <SidebarMenuSub>
                                    {/* Server Overview Item */}
                                    <SidebarMenuSubItem>
                                        <SidebarMenuSubButton asChild className="px-1 py-1">
                                            <Link href={`/servers/${server.id}/stacks`} className="flex items-center gap-1">
                                                <Activity className="h-3 w-3 shrink-0" />
                                                <span className="text-sm">Server Overview</span>
                                            </Link>
                                        </SidebarMenuSubButton>
                                    </SidebarMenuSubItem>

                                    {/* Docker Maintenance Item */}
                                    <SidebarMenuSubItem>
                                        <SidebarMenuSubButton asChild className="px-1 py-1">
                                            <Link href={`/servers/${server.id}/docker`} className="flex items-center gap-1">
                                                <HardDrive className="h-3 w-3 shrink-0" />
                                                <span className="text-sm">Docker Maintenance</span>
                                            </Link>
                                        </SidebarMenuSubButton>
                                    </SidebarMenuSubItem>

                                    {/* Loading state for stacks */}
                                    {isLoadingServerStacks && (
                                        <SidebarMenuSubItem>
                                            <div className="flex items-center gap-1 px-1 py-1 text-sm text-muted-foreground">
                                                <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
                                                <span>Loading stacks...</span>
                                            </div>
                                        </SidebarMenuSubItem>
                                    )}

                                    {/* Stack Items */}
                                    {!isLoadingServerStacks && stacks.length > 0 && (
                                        <>
                                            <div className="px-1 py-1">
                                                <div className="text-xs font-medium text-muted-foreground">Stacks ({stacks.length})</div>
                                            </div>
                                            {stacks.map((stack) => (
                                                <SidebarMenuSubItem key={stack.name}>
                                                    <SidebarMenuSubButton asChild className="px-1 py-1">
                                                        <Link
                                                            href={`/servers/${server.id}/stacks/${stack.name}`}
                                                            className="flex w-full min-w-0 items-center justify-between gap-1"
                                                        >
                                                            <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
                                                                <Layers3 className="h-3 w-3 shrink-0" />
                                                                <span className="truncate text-sm">{stack.name}</span>
                                                            </div>
                                                            <Badge
                                                                variant={stack.overall_status === 'running' ? 'default' : 'outline'}
                                                                className={`h-3.5 shrink-0 px-0.5 py-0 text-[10px] capitalize ${
                                                                    stack.overall_status === 'running'
                                                                        ? 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400'
                                                                        : stack.overall_status === 'partial'
                                                                          ? 'border-yellow-500/30 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400'
                                                                          : stack.overall_status === 'stopped'
                                                                            ? 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400'
                                                                            : 'border-gray-500/30 bg-gray-500/10 text-gray-700 dark:text-gray-400'
                                                                }`}
                                                            >
                                                                {stack.overall_status || 'unknown'}
                                                            </Badge>
                                                        </Link>
                                                    </SidebarMenuSubButton>
                                                </SidebarMenuSubItem>
                                            ))}
                                        </>
                                    )}

                                    {!isLoadingServerStacks && stacks.length === 0 && !isOffline && (
                                        <SidebarMenuSubItem>
                                            <div className="flex items-center gap-1 px-1 py-1 text-sm text-muted-foreground">
                                                <Container className="h-3 w-3 shrink-0" />
                                                <span>No stacks found</span>
                                            </div>
                                        </SidebarMenuSubItem>
                                    )}
                                </SidebarMenuSub>
                            </CollapsibleContent>
                        </SidebarMenuItem>
                    </Collapsible>
                );
            })}
        </SidebarMenu>
    );
}
