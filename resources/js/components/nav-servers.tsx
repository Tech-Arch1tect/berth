import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem } from '@/components/ui/sidebar';
import { useDashboardStats } from '@/hooks/queries/use-dashboard-stats';
import { useServerStacks } from '@/hooks/queries/use-server-stacks';
import type { Server as ServerType, Stack } from '@/types/entities';
import { Link } from '@inertiajs/react';
import { Activity, AlertCircle, ChevronRight, Container, HardDrive, Loader2, Server } from 'lucide-react';
import { useState } from 'react';

interface NavServersProps {
    servers: ServerType[];
}

function ServerNavItem({
    server,
    serverStats,
    isExpanded,
    onToggle,
}: {
    server: ServerType;
    serverStats?: { status?: string; running_services?: number; total_services?: number };
    isExpanded: boolean;
    onToggle: () => void;
}) {
    const isOffline = serverStats?.status === 'offline';

    const { data: serverStacksData, isLoading: isLoadingServerStacks } = useServerStacks(server.id, isExpanded && !isOffline);

    const stacks = serverStacksData || [];

    return (
        <Collapsible open={isExpanded} onOpenChange={onToggle}>
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
                                <Server className="h-4 w-4 shrink-0 text-muted-foreground" />
                            )}
                            <span className="min-w-0 flex-1 truncate font-medium">{server.display_name}</span>
                            {serverStats && !isOffline ? (
                                <div className="flex items-center gap-1">
                                    <Badge variant="secondary" className="h-4 flex-shrink-0 px-1 py-0 text-xs whitespace-nowrap">
                                        {serverStats.running_services}/{serverStats.total_services}
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
                        <SidebarMenuSubItem>
                            <SidebarMenuSubButton asChild className="px-1 py-1">
                                <Link href={`/servers/${server.id}/stacks`} className="flex items-center gap-1">
                                    <Activity className="h-3 w-3 shrink-0" />
                                    <span className="text-sm">Server Overview</span>
                                </Link>
                            </SidebarMenuSubButton>
                        </SidebarMenuSubItem>

                        <SidebarMenuSubItem>
                            <SidebarMenuSubButton asChild className="px-1 py-1">
                                <Link href={`/servers/${server.id}/docker`} className="flex items-center gap-1">
                                    <HardDrive className="h-3 w-3 shrink-0" />
                                    <span className="text-sm">Docker Maintenance</span>
                                </Link>
                            </SidebarMenuSubButton>
                        </SidebarMenuSubItem>

                        {isLoadingServerStacks && (
                            <SidebarMenuSubItem>
                                <div className="flex items-center gap-2 px-2 py-1">
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    <span className="text-xs text-muted-foreground">Loading stacks...</span>
                                </div>
                            </SidebarMenuSubItem>
                        )}

                        {stacks.map((stack) => (
                            <StackItem key={stack.name} serverId={server.id} stack={stack} />
                        ))}
                    </SidebarMenuSub>
                </CollapsibleContent>
            </SidebarMenuItem>
        </Collapsible>
    );
}

function StackItem({ serverId, stack }: { serverId: number; stack: Stack }) {
    const statusText = stack.overall_status || 'unknown';

    let statusColor = 'text-muted-foreground';

    switch (statusText) {
        case 'running':
            statusColor = 'text-green-600';
            break;
        case 'stopped':
            statusColor = 'text-red-600';
            break;
        case 'partial':
            statusColor = 'text-yellow-600';
            break;
        default:
            statusColor = 'text-muted-foreground';
    }

    return (
        <SidebarMenuSubItem>
            <SidebarMenuSubButton asChild className="px-2 py-1">
                <Link href={`/servers/${serverId}/stacks/${stack.name}`} className="flex items-center gap-2">
                    <div className="flex min-w-0 flex-1 items-center gap-1">
                        <Container className="h-3 w-3 shrink-0" />
                        <span className="truncate text-xs">{stack.name}</span>
                    </div>
                    <div className={`text-xs font-medium ${statusColor} shrink-0 capitalize`}>{statusText}</div>
                </Link>
            </SidebarMenuSubButton>
        </SidebarMenuSubItem>
    );
}

export function NavServers({ servers }: NavServersProps) {
    const [expandedServers, setExpandedServers] = useState<Set<number>>(new Set());

    const { data: serverStats = {} } = useDashboardStats();

    const toggleServer = (serverId: number) => {
        const newExpanded = new Set(expandedServers);
        if (newExpanded.has(serverId)) {
            newExpanded.delete(serverId);
        } else {
            newExpanded.add(serverId);
        }
        setExpandedServers(newExpanded);
    };

    return (
        <SidebarMenu className="overflow-x-hidden">
            {servers.map((server) => (
                <ServerNavItem
                    key={server.id}
                    server={server}
                    serverStats={serverStats[server.id]}
                    isExpanded={expandedServers.has(server.id)}
                    onToggle={() => toggleServer(server.id)}
                />
            ))}
        </SidebarMenu>
    );
}
