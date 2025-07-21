import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Container, Globe, HardDrive, Lock, Play, Square, ChevronDown, ChevronRight, Image, Command, Activity } from 'lucide-react';
import type { Stack, UserPermissions } from '@/types/entities';
import { getServiceDisplayState } from '@/utils/stack-utils';
import ServiceStatusBadge from '@/components/ServiceStatusBadge';
import { useState } from 'react';

interface StackServicesProps {
    stack: Stack;
    userPermissions: UserPermissions;
    isOperating: boolean;
    isRefreshing: boolean;
    onStartService: (services: string[]) => void;
    onStopService: (services: string[]) => void;
}

export default function StackServices({
    stack,
    userPermissions,
    isOperating,
    isRefreshing,
    onStartService,
    onStopService,
}: StackServicesProps) {
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
                            <Button
                                onClick={() => onStartService([])}
                                disabled={isOperating || isRefreshing}
                                variant="default"
                                size="sm"
                            >
                                <Play className="h-3 w-3 mr-1" />
                                Up All
                            </Button>
                            <Button
                                onClick={() => onStopService([])}
                                disabled={isOperating || isRefreshing}
                                variant="destructive"
                                size="sm"
                            >
                                <Square className="h-3 w-3 mr-1" />
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
                            <div key={serviceName} className="border rounded-lg border-border bg-card">
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
                                                {isExpanded ? 
                                                    <ChevronDown className="h-3 w-3" /> : 
                                                    <ChevronRight className="h-3 w-3" />
                                                }
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
                                                    <Button
                                                        onClick={() => onStartService([serviceName])}
                                                        disabled={isOperating || isRefreshing || isRunning}
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-7 w-7 p-0"
                                                    >
                                                        <Play className="h-3 w-3" />
                                                    </Button>
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
                                        <Badge variant="outline" className="text-xs">{service.restart}</Badge>
                                        {serviceStatus?.ports ? (
                                            <span className={`text-xs ${serviceStatus.ports.includes('->') ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                                                {serviceStatus.ports}
                                            </span>
                                        ) : service.ports && service.ports.length > 0 ? (
                                            <span className="text-xs">{service.ports.length} port{service.ports.length !== 1 ? 's' : ''}</span>
                                        ) : null}
                                        {service.volumes && service.volumes.length > 0 && (
                                            <span className="text-xs">{service.volumes.length} volume{service.volumes.length !== 1 ? 's' : ''}</span>
                                        )}
                                    </div>
                                </div>
                                
                                {/* Expandable Details */}
                                {isExpanded && (
                                    <div className="border-t border-border bg-muted/30">
                                        <div className="p-4 space-y-4">
                                            {/* Runtime Status */}
                                            {serviceStatus && (
                                                <div className="space-y-2">
                                                    <h4 className="font-medium text-sm flex items-center gap-2">
                                                        <Activity className="h-3 w-3" />
                                                        Runtime Status
                                                    </h4>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                                        <div className="space-y-1">
                                                            <span className="text-muted-foreground">Container:</span>
                                                            <code className="block text-xs bg-muted px-2 py-1 rounded font-mono">
                                                                {serviceStatus.name}
                                                            </code>
                                                        </div>
                                                        {serviceStatus.command && (
                                                            <div className="space-y-1">
                                                                <span className="text-muted-foreground">Running Command:</span>
                                                                <code className="block text-xs bg-muted px-2 py-1 rounded font-mono break-all">
                                                                    {serviceStatus.command}
                                                                </code>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                            
                                            {/* Configuration Details */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {/* Image */}
                                                <div className="space-y-2">
                                                    <h4 className="font-medium text-sm flex items-center gap-2">
                                                        <Image className="h-3 w-3" />
                                                        Image
                                                    </h4>
                                                    <code className="block text-xs bg-muted px-2 py-1 rounded font-mono">
                                                        {service.image}
                                                    </code>
                                                </div>
                                                
                                                {/* Command */}
                                                {service.command && (
                                                    <div className="space-y-2">
                                                        <h4 className="font-medium text-sm flex items-center gap-2">
                                                            <Command className="h-3 w-3" />
                                                            Command
                                                        </h4>
                                                        <code className="block text-xs bg-muted px-2 py-1 rounded font-mono">
                                                            {service.command}
                                                        </code>
                                                    </div>
                                                )}
                                                
                                                {/* Ports */}
                                                {service.ports && service.ports.length > 0 && (
                                                    <div className="space-y-2">
                                                        <h4 className="font-medium text-sm flex items-center gap-2">
                                                            <Globe className="h-3 w-3" />
                                                            Ports ({service.ports.length})
                                                        </h4>
                                                        <div className="space-y-1">
                                                            {service.ports.map((port, index) => (
                                                                <Badge key={index} variant="outline" className="text-xs mr-1">
                                                                    {port.published}:{port.target} ({port.protocol})
                                                                </Badge>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                
                                                {/* Volumes */}
                                                {service.volumes && service.volumes.length > 0 && (
                                                    <div className="space-y-2">
                                                        <h4 className="font-medium text-sm flex items-center gap-2">
                                                            <HardDrive className="h-3 w-3" />
                                                            Volumes ({service.volumes.length})
                                                        </h4>
                                                        <div className="space-y-2">
                                                            {service.volumes.map((volume, index) => (
                                                                <div key={index} className="flex items-center gap-2 text-xs">
                                                                    {volume.read_only && <Lock className="h-3 w-3 text-muted-foreground" />}
                                                                    <code className="bg-muted px-2 py-1 rounded font-mono">
                                                                        {volume.source} → {volume.target}
                                                                    </code>
                                                                    {volume.read_only && (
                                                                        <Badge variant="outline" className="text-xs">RO</Badge>
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