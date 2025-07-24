import { useState, useEffect } from 'react';
import { Link } from '@inertiajs/react';
import { 
    SidebarMenu, 
    SidebarMenuItem, 
    SidebarMenuButton,
    SidebarMenuSub,
    SidebarMenuSubItem,
    SidebarMenuSubButton
} from '@/components/ui/sidebar';
import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuItem, 
    DropdownMenuTrigger,
    DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { 
    Server, 
    ChevronRight, 
    Container, 
    Layers3, 
    Activity,
    AlertCircle,
    Loader2
} from 'lucide-react';
import type { Server as ServerType } from '@/types/entities';
import { apiGet } from '@/utils/api';
import { calculateServiceStatusSummary } from '@/utils/stack-utils';

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
        
        setLoadingStacks(prev => new Set(prev).add(serverId));
        
        try {
            const response = await apiGet(`/api/servers/${serverId}/stacks`);
            if (response.success) {
                const stacks = (response.data as { stacks: any[] }).stacks;
                
                const stacksWithStatus = await Promise.all(
                    stacks.map(async (stack: any) => {
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
                                
                                const { overallStatus } = calculateServiceStatusSummary(stack, serviceStatus);
                                
                                return {
                                    name: stack.name,
                                    service_count: stack.service_count || 0,
                                    overall_status: overallStatus
                                };
                            }
                        } catch (statusError) {
                            console.error(`Failed to fetch status for stack ${stack.name}:`, statusError);
                        }
                        
                        return {
                            name: stack.name,
                            service_count: stack.service_count || 0,
                            overall_status: 'unknown' as const
                        };
                    })
                );
                
                setServerStacks(prev => ({
                    ...prev,
                    [serverId]: stacksWithStatus
                }));
            }
        } catch (error) {
            console.error(`Failed to fetch stacks for server ${serverId}:`, error);
        } finally {
            setLoadingStacks(prev => {
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
                    <Collapsible
                        key={server.id}
                        open={isExpanded}
                        onOpenChange={() => toggleServer(server.id)}
                    >
                        <SidebarMenuItem>
                            <CollapsibleTrigger asChild>
                                <SidebarMenuButton 
                                    tooltip={`${server.display_name} - ${server.hostname}:${server.port}`}
                                    className="group w-full overflow-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                                >
                                    <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                                        {isOffline ? (
                                            <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
                                        ) : (
                                            <Server className="h-4 w-4 shrink-0" />
                                        )}
                                        <span className="truncate flex-1 min-w-0">{server.display_name}</span>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0 min-w-0">
                                        {isLoadingStats ? (
                                            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground flex-shrink-0" />
                                        ) : stats && !isOffline ? (
                                            <div className="flex items-center gap-1 min-w-0 overflow-hidden">
                                                <Badge variant="outline" className="text-xs px-1 py-0 h-4 whitespace-nowrap flex-shrink-0 overflow-hidden">
                                                    {stats.running_stacks}/{stats.total_stacks}
                                                </Badge>
                                                <Badge variant="outline" className="text-xs px-1 py-0 h-4 whitespace-nowrap flex-shrink-0 overflow-hidden">
                                                    {stats.running_services}/{stats.total_services}
                                                </Badge>
                                            </div>
                                        ) : isOffline ? (
                                            <Badge variant="destructive" className="text-xs px-1 py-0 h-4 whitespace-nowrap flex-shrink-0">
                                                Offline
                                            </Badge>
                                        ) : null}
                                        <ChevronRight className={`h-3 w-3 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-90' : ''}`} />
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
                                    
                                    {/* Loading state for stacks */}
                                    {isLoadingServerStacks && (
                                        <SidebarMenuSubItem>
                                            <div className="px-1 py-1 flex items-center gap-1 text-sm text-muted-foreground">
                                                <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                                                <span>Loading stacks...</span>
                                            </div>
                                        </SidebarMenuSubItem>
                                    )}
                                    
                                    {/* Stack Items */}
                                    {!isLoadingServerStacks && stacks.length > 0 && (
                                        <>
                                            <div className="px-1 py-1">
                                                <div className="text-xs text-muted-foreground font-medium">
                                                    Stacks ({stacks.length})
                                                </div>
                                            </div>
                                            {stacks.map((stack) => (
                                                <SidebarMenuSubItem key={stack.name}>
                                                    <SidebarMenuSubButton asChild className="px-1 py-1">
                                                        <Link 
                                                            href={`/servers/${server.id}/stacks/${stack.name}`}
                                                            className="flex items-center justify-between w-full min-w-0 gap-1"
                                                        >
                                                            <div className="flex items-center gap-1 min-w-0 flex-1 overflow-hidden">
                                                                <Layers3 className="h-3 w-3 shrink-0" />
                                                                <span className="truncate text-sm">{stack.name}</span>
                                                            </div>
                                                            <Badge 
                                                                variant={stack.overall_status === 'running' ? 'default' : 'outline'}
                                                                className={`text-[10px] px-0.5 py-0 h-3.5 capitalize shrink-0 ${
                                                                    stack.overall_status === 'running' 
                                                                        ? 'bg-green-500/10 text-green-700 border-green-500/30 dark:text-green-400' 
                                                                        : stack.overall_status === 'partial'
                                                                        ? 'bg-yellow-500/10 text-yellow-700 border-yellow-500/30 dark:text-yellow-400'
                                                                        : stack.overall_status === 'stopped'
                                                                        ? 'bg-red-500/10 text-red-700 border-red-500/30 dark:text-red-400'
                                                                        : 'bg-gray-500/10 text-gray-700 border-gray-500/30 dark:text-gray-400'
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
                                            <div className="px-1 py-1 flex items-center gap-1 text-sm text-muted-foreground">
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