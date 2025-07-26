import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { Stack, UserPermissions } from '@/types/entities';
import { getServiceDisplayState } from '@/utils/stack-utils';
import { Activity, ChevronDown, ChevronRight, Command, Container, Globe, Hammer, HardDrive, Image, Lock, Network, Play, Square } from 'lucide-react';
import { useState } from 'react';

interface EnhancedStackServicesProps {
    stack: Stack;
    userPermissions: UserPermissions;
    isOperating: boolean;
    isRefreshing: boolean;
    onStartService: (services: string[], build?: boolean) => void;
    onStopService: (services: string[]) => void;
}

export default function EnhancedStackServices({
    stack,
    userPermissions,
    isOperating,
    isRefreshing,
    onStartService,
    onStopService,
}: EnhancedStackServicesProps) {
    const [expandedServices, setExpandedServices] = useState<Set<string>>(new Set());

    const toggleServiceExpansion = (serviceName: string) => {
        setExpandedServices((prev) => {
            const newExpanded = new Set(prev);
            if (newExpanded.has(serviceName)) {
                newExpanded.delete(serviceName);
            } else {
                newExpanded.add(serviceName);
            }
            return newExpanded;
        });
    };

    return (
        <div className="space-y-6">
            <Card className="shadow-sm">
                <CardHeader className="pb-4">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-accent/20">
                                <Container className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <CardTitle className="text-xl">Services Overview</CardTitle>
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
                                        size="lg"
                                        className="gap-2 rounded-r-none"
                                    >
                                        <Play className="h-4 w-4" />
                                        Start All
                                    </Button>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button
                                                disabled={isOperating || isRefreshing}
                                                size="lg"
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
                                    size="lg"
                                    className="gap-2"
                                >
                                    <Square className="h-4 w-4" />
                                    Stop All
                                </Button>
                            </div>
                        )}
                    </div>
                </CardHeader>
            </Card>

            <Card className="shadow-sm">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Container className="h-5 w-5" />
                        Service Details
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {Object.entries(stack.services).map(([serviceName, service]) => {
                            const { isRunning, displayState, serviceStatus } = getServiceDisplayState(stack, serviceName);
                            const isExpanded = expandedServices.has(serviceName);

                            return (
                                <div key={serviceName} className="rounded-lg border border-border bg-card transition-all hover:shadow-md">
                                    <div className="p-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 w-8 p-0"
                                                    onClick={() => toggleServiceExpansion(serviceName)}
                                                >
                                                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                                </Button>
                                                <div className="flex items-center gap-2">
                                                    <div
                                                        className={`h-3 w-3 rounded-full transition-all duration-300 ${
                                                            isRunning ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-red-500'
                                                        }`}
                                                    />
                                                    <h3 className="text-lg font-semibold">{serviceName}</h3>
                                                </div>
                                                <Badge
                                                    variant={isRunning ? 'default' : 'secondary'}
                                                    className={`text-xs ${
                                                        isRunning
                                                            ? 'bg-green-500/10 text-green-700 dark:text-green-400'
                                                            : 'bg-red-500/10 text-red-700 dark:text-red-400'
                                                    }`}
                                                >
                                                    {displayState}
                                                </Badge>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {userPermissions['start-stop'] && (
                                                    <>
                                                        <div className="flex">
                                                            <Button
                                                                onClick={() => onStartService([serviceName], false)}
                                                                disabled={isOperating || isRefreshing}
                                                                variant="outline"
                                                                size="sm"
                                                                className="gap-1 rounded-r-none"
                                                            >
                                                                <Play className="h-3 w-3" />
                                                                Start
                                                            </Button>
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <Button
                                                                        disabled={isOperating || isRefreshing}
                                                                        variant="outline"
                                                                        size="sm"
                                                                        className="rounded-l-none border-l-0 px-2"
                                                                    >
                                                                        <ChevronDown className="h-3 w-3" />
                                                                    </Button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end">
                                                                    <DropdownMenuItem onClick={() => onStartService([serviceName], false)}>
                                                                        <Play className="mr-2 h-3 w-3" />
                                                                        Start
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem onClick={() => onStartService([serviceName], true)}>
                                                                        <Hammer className="mr-2 h-3 w-3" />
                                                                        Start --build
                                                                    </DropdownMenuItem>
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        </div>
                                                        <Button
                                                            onClick={() => onStopService([serviceName])}
                                                            disabled={isOperating || isRefreshing || !isRunning}
                                                            variant="outline"
                                                            size="sm"
                                                            className="gap-1"
                                                        >
                                                            <Square className="h-3 w-3" />
                                                            Stop
                                                        </Button>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                                            <div className="flex items-center gap-2">
                                                <Image className="h-4 w-4" />
                                                <span className="font-mono text-xs">{service.image}</span>
                                            </div>
                                            <Badge variant="outline" className="text-xs">
                                                {service.restart}
                                            </Badge>
                                            {serviceStatus?.ports && (
                                                <span
                                                    className={`text-xs ${
                                                        serviceStatus.ports.includes('->')
                                                            ? 'text-green-600 dark:text-green-400'
                                                            : 'text-muted-foreground'
                                                    }`}
                                                >
                                                    {serviceStatus.ports}
                                                </span>
                                            )}
                                            {serviceStatus?.networks && serviceStatus.networks.length > 0 && (
                                                <div className="flex flex-wrap gap-1">
                                                    {serviceStatus.networks.slice(0, 2).map((network, networkIndex) => (
                                                        <span
                                                            key={networkIndex}
                                                            className="inline-flex items-center rounded-md bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                                                            title={`${network.name}: ${network.ip_address}`}
                                                        >
                                                            {network.ip_address}
                                                        </span>
                                                    ))}
                                                    {serviceStatus.networks.length > 2 && (
                                                        <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                                                            +{serviceStatus.networks.length - 2}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {isExpanded && (
                                        <div className="border-t border-border bg-muted/30">
                                            <div className="space-y-6 p-6">
                                                {serviceStatus && (
                                                    <div className="space-y-3">
                                                        <h4 className="flex items-center gap-2 text-sm font-medium">
                                                            <Activity className="h-4 w-4" />
                                                            Runtime Status
                                                        </h4>
                                                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                                            <div className="space-y-2">
                                                                <span className="text-sm text-muted-foreground">Container:</span>
                                                                <code className="block rounded bg-background px-3 py-2 font-mono text-sm">
                                                                    {serviceStatus.name}
                                                                </code>
                                                            </div>
                                                            {serviceStatus.id && (
                                                                <div className="space-y-2">
                                                                    <span className="text-sm text-muted-foreground">Container ID:</span>
                                                                    <code className="block rounded bg-background px-3 py-2 font-mono text-sm">
                                                                        {serviceStatus.id.substring(0, 12)}
                                                                    </code>
                                                                </div>
                                                            )}
                                                            {serviceStatus.command && (
                                                                <div className="space-y-2 md:col-span-2">
                                                                    <span className="text-sm text-muted-foreground">Running Command:</span>
                                                                    <code className="block rounded bg-background px-3 py-2 font-mono text-sm">
                                                                        {serviceStatus.command}
                                                                    </code>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {serviceStatus && serviceStatus.networks && serviceStatus.networks.length > 0 && (
                                                    <div className="space-y-3">
                                                        <h4 className="flex items-center gap-2 text-sm font-medium">
                                                            <Network className="h-4 w-4" />
                                                            Networks ({serviceStatus.networks.length})
                                                        </h4>
                                                        <div className="space-y-3">
                                                            {serviceStatus.networks.map((network, index) => (
                                                                <div key={index} className="rounded-lg bg-background p-4">
                                                                    <div className="mb-3 flex items-center justify-between">
                                                                        <span className="font-medium">{network.name}</span>
                                                                    </div>
                                                                    <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                                                                        {network.ip_address && (
                                                                            <div className="flex justify-between">
                                                                                <span className="text-muted-foreground">IP Address:</span>
                                                                                <code className="rounded bg-muted px-2 py-1 font-mono text-xs">
                                                                                    {network.ip_address}
                                                                                </code>
                                                                            </div>
                                                                        )}
                                                                        {network.gateway && (
                                                                            <div className="flex justify-between">
                                                                                <span className="text-muted-foreground">Gateway:</span>
                                                                                <code className="rounded bg-muted px-2 py-1 font-mono text-xs">
                                                                                    {network.gateway}
                                                                                </code>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                                                    <div className="space-y-3">
                                                        <h4 className="flex items-center gap-2 text-sm font-medium">
                                                            <Image className="h-4 w-4" />
                                                            Image
                                                        </h4>
                                                        <code className="block rounded bg-background px-3 py-2 font-mono text-sm">
                                                            {service.image}
                                                        </code>
                                                    </div>

                                                    {service.command && (
                                                        <div className="space-y-3">
                                                            <h4 className="flex items-center gap-2 text-sm font-medium">
                                                                <Command className="h-4 w-4" />
                                                                Command
                                                            </h4>
                                                            <code className="block rounded bg-background px-3 py-2 font-mono text-sm">
                                                                {service.command}
                                                            </code>
                                                        </div>
                                                    )}

                                                    {service.ports && service.ports.length > 0 && (
                                                        <div className="space-y-3">
                                                            <h4 className="flex items-center gap-2 text-sm font-medium">
                                                                <Globe className="h-4 w-4" />
                                                                Ports ({service.ports.length})
                                                            </h4>
                                                            <div className="space-y-2">
                                                                {service.ports.map((port, index) => (
                                                                    <div
                                                                        key={index}
                                                                        className="flex items-center justify-between rounded bg-background px-3 py-2 text-sm"
                                                                    >
                                                                        <code className="font-mono text-xs">
                                                                            {port.published}:{port.target}
                                                                        </code>
                                                                        <Badge variant="outline" className="text-xs">
                                                                            {port.protocol}
                                                                        </Badge>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {service.volumes && service.volumes.length > 0 && (
                                                        <div className="space-y-3">
                                                            <h4 className="flex items-center gap-2 text-sm font-medium">
                                                                <HardDrive className="h-4 w-4" />
                                                                Volumes ({service.volumes.length})
                                                            </h4>
                                                            <div className="space-y-2">
                                                                {service.volumes.map((volume, index) => (
                                                                    <div
                                                                        key={index}
                                                                        className="flex items-center gap-2 rounded bg-background px-3 py-2 text-sm"
                                                                    >
                                                                        {volume.read_only && <Lock className="h-3 w-3 text-muted-foreground" />}
                                                                        <code className="flex-1 font-mono text-xs">
                                                                            {volume.source} → {volume.target}
                                                                        </code>
                                                                        {volume.read_only && (
                                                                            <Badge variant="outline" className="text-xs">
                                                                                RO
                                                                            </Badge>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
