import ServiceStatusProgressBar from '@/components/ServiceStatusProgressBar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { Stack, UserPermissions } from '@/types/entities';
import { getServiceDisplayState } from '@/utils/stack-utils';
import { ChevronDown, Container, Globe, Hammer, Image, Network, Play, Square } from 'lucide-react';

interface StackServicesCompactProps {
    stack: Stack;
    userPermissions: UserPermissions;
    isOperating: boolean;
    isRefreshing: boolean;
    onStartService: (services: string[], build?: boolean) => void;
    onStopService: (services: string[]) => void;
}

export default function StackServicesCompact({
    stack,
    userPermissions,
    isOperating,
    isRefreshing,
    onStartService,
    onStopService,
}: StackServicesCompactProps) {
    return (
        <Card className="shadow-sm">
            <CardHeader className="pb-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-accent/20">
                            <Container className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <CardTitle className="text-xl">Services</CardTitle>
                            <p className="text-sm text-muted-foreground">
                                {stack.service_count} services configured
                                {stack.service_status_summary &&
                                    ` • ${stack.service_status_summary.running}/${stack.service_status_summary.total} running`}
                            </p>
                        </div>
                    </div>
                    {userPermissions['start-stop'] && (
                        <div className="flex items-center gap-2">
                            <div className="flex">
                                <Button
                                    onClick={() => onStartService([], false)}
                                    disabled={isOperating || isRefreshing}
                                    size="sm"
                                    className="gap-2 rounded-r-none"
                                >
                                    <Play className="h-4 w-4" />
                                    Start All
                                </Button>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            disabled={isOperating || isRefreshing}
                                            size="sm"
                                            className="rounded-l-none border-l border-l-primary-foreground/20 px-3"
                                        >
                                            <ChevronDown className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => onStartService([], false)}>
                                            <Play className="mr-2 h-4 w-4" />
                                            Start All
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => onStartService([], true)}>
                                            <Hammer className="mr-2 h-4 w-4" />
                                            Start All --build
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                            <Button
                                onClick={() => onStopService([])}
                                disabled={isOperating || isRefreshing}
                                variant="destructive"
                                size="sm"
                                className="gap-2"
                            >
                                <Square className="h-4 w-4" />
                                Stop All
                            </Button>
                        </div>
                    )}
                </div>
            </CardHeader>
            <CardContent>
                {stack.service_status_summary && (
                    <div className="mb-6">
                        <ServiceStatusProgressBar serviceStatusSummary={stack.service_status_summary} isLoading={false} />
                    </div>
                )}

                <div className="space-y-3">
                    {Object.entries(stack.services).map(([serviceName, service]) => {
                        const { isRunning, displayState, serviceStatus } = getServiceDisplayState(stack, serviceName);

                        return (
                            <div key={serviceName} className="flex items-center justify-between rounded-lg border bg-card p-3">
                                <div className="flex items-center gap-3">
                                    <div className={`h-2 w-2 rounded-full ${isRunning ? 'bg-green-500' : 'bg-red-500'}`} />
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium">{serviceName}</span>
                                        <Badge variant={isRunning ? 'default' : 'secondary'} className="text-xs">
                                            {displayState}
                                        </Badge>
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                        <div className="flex items-center gap-1">
                                            <Image className="h-3 w-3" />
                                            <span className="max-w-32 truncate font-mono">{service.image}</span>
                                        </div>
                                        {serviceStatus?.ports && (
                                            <div className="flex items-center gap-1">
                                                <Globe className="h-3 w-3" />
                                                <span className="font-mono">{serviceStatus.ports}</span>
                                            </div>
                                        )}
                                        {serviceStatus?.networks && serviceStatus.networks.length > 0 && (
                                            <div className="flex items-center gap-1">
                                                <Network className="h-3 w-3" />
                                                <span className="font-mono">{serviceStatus.networks[0]?.ip_address}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                {userPermissions['start-stop'] && (
                                    <div className="flex items-center gap-1">
                                        <Button
                                            onClick={() => onStartService([serviceName], false)}
                                            disabled={isOperating || isRefreshing}
                                            variant="outline"
                                            size="sm"
                                            className="h-7 px-2"
                                        >
                                            <Play className="h-3 w-3" />
                                        </Button>
                                        <Button
                                            onClick={() => onStopService([serviceName])}
                                            disabled={isOperating || isRefreshing || !isRunning}
                                            variant="outline"
                                            size="sm"
                                            className="h-7 px-2"
                                        >
                                            <Square className="h-3 w-3" />
                                        </Button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}
