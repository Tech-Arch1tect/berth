import ServiceStatusBadge from '@/components/ServiceStatusBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { Stack, UserPermissions } from '@/types/entities';
import { getServiceDisplayState } from '@/utils/stack-utils';
import { Activity, ChevronDown, ChevronRight, Command, Container, Globe, Hammer, HardDrive, Image, Lock, Network, Play, Square } from 'lucide-react';
import { useState } from 'react';

interface StackServicesProps {
    stack: Stack;
    userPermissions: UserPermissions;
    isOperating: boolean;
    isRefreshing: boolean;
    onStartService: (services: string[], build?: boolean) => void;
    onStopService: (services: string[]) => void;
}

export default function StackServices({ stack, userPermissions, isOperating, isRefreshing, onStartService, onStopService }: StackServicesProps) {
    const [expandedServices, setExpandedServices] = useState<Set<string>>(new Set());

    const toggleServiceExpansion = (serviceName: string) => {
        const newExpanded = new Set(expandedServices);
        if (newExpanded.has(serviceName)) {
            newExpanded.delete(serviceName);
        } else {
            newExpanded.add(serviceName);
        }
        setExpandedServices(newExpanded);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Container className="h-5 w-5" />
                        Services ({stack.service_count})
                        {stack.service_status_summary && (
                            <Badge variant="outline" className="text-xs">
                                {stack.service_status_summary.running}/{stack.service_status_summary.total} running
                            </Badge>
                        )}
                    </div>
                    {userPermissions['start-stop'] && (
                        <div className="flex items-center gap-2">
                            <div className="flex">
                                <Button
                                    onClick={() => onStartService([], false)}
                                    disabled={isOperating || isRefreshing}
                                    variant="default"
                                    size="sm"
                                    className="rounded-r-none pr-3"
                                >
                                    <Play className="mr-1 h-3 w-3" />
                                    Up All
                                </Button>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            disabled={isOperating || isRefreshing}
                                            variant="default"
                                            size="sm"
                                            className="rounded-l-none border-l border-l-primary-foreground/20 pr-2 pl-2"
                                        >
                                            <ChevronDown className="h-3 w-3" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => onStartService([], false)}>
                                            <Play className="mr-2 h-3 w-3" />
                                            Up All
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => onStartService([], true)}>
                                            <Hammer className="mr-2 h-3 w-3" />
                                            Up All --build
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                            <Button onClick={() => onStopService([])} disabled={isOperating || isRefreshing} variant="destructive" size="sm">
                                <Square className="mr-1 h-3 w-3" />
                                Down All
                            </Button>
                        </div>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {Object.entries(stack.services).map(([serviceName, service]) => {
                        const { isRunning, displayState, serviceStatus } = getServiceDisplayState(stack, serviceName);
                        const isExpanded = expandedServices.has(serviceName);

                        return (
                            <div key={serviceName} className="rounded-lg border border-border bg-card">
                                {/* Service Header */}
                                <div className="p-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 w-6 p-0"
                                                onClick={() => toggleServiceExpansion(serviceName)}
                                            >
                                                {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                            </Button>
                                            <div className="flex items-center gap-2">
                                                <Container className="h-4 w-4 text-muted-foreground" />
                                                <h3 className="font-semibold">{serviceName}</h3>
                                            </div>
                                            <ServiceStatusBadge status={displayState} size="sm" />
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
                                                            className="h-7 w-7 rounded-r-none p-0"
                                                        >
                                                            <Play className="h-3 w-3" />
                                                        </Button>
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button
                                                                    disabled={isOperating || isRefreshing}
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="h-7 w-4 rounded-l-none border-l-0 p-0"
                                                                >
                                                                    <ChevronDown className="h-2 w-2" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end">
                                                                <DropdownMenuItem onClick={() => onStartService([serviceName], false)}>
                                                                    <Play className="mr-2 h-3 w-3" />
                                                                    Up
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem onClick={() => onStartService([serviceName], true)}>
                                                                    <Hammer className="mr-2 h-3 w-3" />
                                                                    Up --build
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </div>
                                                    <Button
                                                        onClick={() => onStopService([serviceName])}
                                                        disabled={isOperating || isRefreshing || !isRunning}
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-7 w-7 p-0"
                                                    >
                                                        <Square className="h-3 w-3" />
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Quick Info Bar */}
                                    <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
                                        <div className="flex items-center gap-1">
                                            <Image className="h-3 w-3" />
                                            <span className="font-mono text-xs">{service.image}</span>
                                        </div>
                                        <Badge variant="outline" className="text-xs">
                                            {service.restart}
                                        </Badge>
                                        {serviceStatus?.ports ? (
                                            <span
                                                className={`text-xs ${serviceStatus.ports.includes('->') ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}
                                            >
                                                {serviceStatus.ports}
                                            </span>
                                        ) : service.ports && service.ports.length > 0 ? (
                                            <span className="text-xs">
                                                {service.ports.length} port{service.ports.length !== 1 ? 's' : ''}
                                            </span>
                                        ) : null}
                                        {serviceStatus?.networks && serviceStatus.networks.length > 0 && (
                                            <div className="flex items-center gap-1">
                                                <Network className="h-3 w-3" />
                                                <span className="font-mono text-xs text-blue-600 dark:text-blue-400">
                                                    {serviceStatus.networks
                                                        .map((network) => network.ip_address)
                                                        .filter(Boolean)
                                                        .join(', ')}
                                                </span>
                                            </div>
                                        )}
                                        {service.volumes && service.volumes.length > 0 && (
                                            <span className="text-xs">
                                                {service.volumes.length} volume{service.volumes.length !== 1 ? 's' : ''}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Expandable Details */}
                                {isExpanded && (
                                    <div className="border-t border-border bg-muted/30">
                                        <div className="space-y-4 p-4">
                                            {/* Runtime Status */}
                                            {serviceStatus && (
                                                <div className="space-y-2">
                                                    <h4 className="flex items-center gap-2 text-sm font-medium">
                                                        <Activity className="h-3 w-3" />
                                                        Runtime Status
                                                    </h4>
                                                    <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                                                        <div className="space-y-1">
                                                            <span className="text-muted-foreground">Container:</span>
                                                            <code className="block rounded bg-muted px-2 py-1 font-mono text-xs">
                                                                {serviceStatus.name}
                                                            </code>
                                                        </div>
                                                        {serviceStatus.id && (
                                                            <div className="space-y-1">
                                                                <span className="text-muted-foreground">Container ID:</span>
                                                                <code className="block rounded bg-muted px-2 py-1 font-mono text-xs">
                                                                    {serviceStatus.id.substring(0, 12)}
                                                                </code>
                                                            </div>
                                                        )}
                                                        {serviceStatus.command && (
                                                            <div className="space-y-1 md:col-span-2">
                                                                <span className="text-muted-foreground">Running Command:</span>
                                                                <code className="block rounded bg-muted px-2 py-1 font-mono text-xs break-all">
                                                                    {serviceStatus.command}
                                                                </code>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Network Information */}
                                            {serviceStatus && serviceStatus.networks && serviceStatus.networks.length > 0 && (
                                                <div className="space-y-2">
                                                    <h4 className="flex items-center gap-2 text-sm font-medium">
                                                        <Network className="h-3 w-3" />
                                                        Networks ({serviceStatus.networks.length})
                                                    </h4>
                                                    <div className="space-y-2">
                                                        {serviceStatus.networks.map((network, index) => (
                                                            <div key={index} className="rounded bg-muted/50 p-3">
                                                                <div className="mb-2 flex items-center justify-between">
                                                                    <span className="text-sm font-medium">{network.name}</span>
                                                                </div>
                                                                <div className="grid grid-cols-1 gap-2 text-xs md:grid-cols-2">
                                                                    {network.ip_address && (
                                                                        <div className="flex justify-between">
                                                                            <span className="text-muted-foreground">IP Address:</span>
                                                                            <code className="rounded bg-background px-2 py-1 font-mono">
                                                                                {network.ip_address}
                                                                            </code>
                                                                        </div>
                                                                    )}
                                                                    {network.gateway && (
                                                                        <div className="flex justify-between">
                                                                            <span className="text-muted-foreground">Gateway:</span>
                                                                            <code className="rounded bg-background px-2 py-1 font-mono">
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

                                            {/* Configuration Details */}
                                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                                {/* Image */}
                                                <div className="space-y-2">
                                                    <h4 className="flex items-center gap-2 text-sm font-medium">
                                                        <Image className="h-3 w-3" />
                                                        Image
                                                    </h4>
                                                    <code className="block rounded bg-muted px-2 py-1 font-mono text-xs">{service.image}</code>
                                                </div>

                                                {/* Command */}
                                                {service.command && (
                                                    <div className="space-y-2">
                                                        <h4 className="flex items-center gap-2 text-sm font-medium">
                                                            <Command className="h-3 w-3" />
                                                            Command
                                                        </h4>
                                                        <code className="block rounded bg-muted px-2 py-1 font-mono text-xs">{service.command}</code>
                                                    </div>
                                                )}

                                                {/* Ports */}
                                                {service.ports && service.ports.length > 0 && (
                                                    <div className="space-y-2">
                                                        <h4 className="flex items-center gap-2 text-sm font-medium">
                                                            <Globe className="h-3 w-3" />
                                                            Ports ({service.ports.length})
                                                        </h4>
                                                        <div className="space-y-1">
                                                            {service.ports.map((port, index) => (
                                                                <Badge key={index} variant="outline" className="mr-1 text-xs">
                                                                    {port.published}:{port.target} ({port.protocol})
                                                                </Badge>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Volumes */}
                                                {service.volumes && service.volumes.length > 0 && (
                                                    <div className="space-y-2">
                                                        <h4 className="flex items-center gap-2 text-sm font-medium">
                                                            <HardDrive className="h-3 w-3" />
                                                            Volumes ({service.volumes.length})
                                                        </h4>
                                                        <div className="space-y-2">
                                                            {service.volumes.map((volume, index) => (
                                                                <div key={index} className="flex items-center gap-2 text-xs">
                                                                    {volume.read_only && <Lock className="h-3 w-3 text-muted-foreground" />}
                                                                    <code className="rounded bg-muted px-2 py-1 font-mono">
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
    );
}
