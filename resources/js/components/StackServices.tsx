import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Container, Globe, HardDrive, Lock, Play, Square } from 'lucide-react';
import type { Stack, UserPermissions } from '@/types/entities';
import { getServiceDisplayState } from '@/utils/stack-utils';

interface StackServicesProps {
    stack: Stack;
    userPermissions: UserPermissions;
    isStarting: boolean;
    isStopping: boolean;
    isRefreshing: boolean;
    onStartService: (services: string[]) => void;
    onStopService: (services: string[]) => void;
}

export default function StackServices({
    stack,
    userPermissions,
    isStarting,
    isStopping,
    isRefreshing,
    onStartService,
    onStopService,
}: StackServicesProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Container size={20} />
                    Services ({stack.service_count})
                    {stack.service_status_summary && (
                        <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                            {stack.service_status_summary.running}/{stack.service_status_summary.total} running
                        </span>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {Object.entries(stack.services).map(([serviceName, service]) => {
                        const { isRunning, displayState, serviceStatus } = getServiceDisplayState(stack, serviceName);
                        
                        return (
                            <div key={serviceName} className="border rounded-lg p-4 dark:border-gray-700">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-semibold text-lg">{serviceName}</h3>
                                        <Badge 
                                            variant={isRunning ? 'default' : 'outline'}
                                        >
                                            {displayState}
                                        </Badge>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {userPermissions['start-stop'] && (
                                            <>
                                                <Button
                                                    onClick={() => onStartService([serviceName])}
                                                    disabled={isStarting || isRefreshing}
                                                    variant="outline"
                                                    size="sm"
                                                >
                                                    <Play className="h-3 w-3" />
                                                </Button>
                                                <Button
                                                    onClick={() => onStopService([serviceName])}
                                                    disabled={isStopping || isRefreshing}
                                                    variant="outline"
                                                    size="sm"
                                                >
                                                    <Square className="h-3 w-3" />
                                                </Button>
                                            </>
                                        )}
                                        <Badge variant="outline">{service.restart}</Badge>
                                    </div>
                                </div>
                                
                                {/* Show runtime information if available */}
                                {serviceStatus && (
                                    <div className="mb-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                        <h4 className="font-medium text-sm text-gray-900 dark:text-gray-100 mb-2">Runtime Status</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                                            <div>
                                                <span className="text-gray-600 dark:text-gray-400">Container:</span>
                                                <span className="ml-2 font-mono text-gray-900 dark:text-gray-100">{serviceStatus.name}</span>
                                            </div>
                                            {serviceStatus.ports && (
                                                <div>
                                                    <span className="text-gray-600 dark:text-gray-400">Ports:</span>
                                                    <span className="ml-2 font-mono text-gray-900 dark:text-gray-100">{serviceStatus.ports}</span>
                                                </div>
                                            )}
                                            <div className="md:col-span-2">
                                                <span className="text-gray-600 dark:text-gray-400">Command:</span>
                                                <span className="ml-2 font-mono text-gray-900 dark:text-gray-100 break-all">{serviceStatus.command}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <h4 className="font-medium text-sm text-gray-900 dark:text-gray-100 mb-2">Image</h4>
                                    <code className="text-sm bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                                        {service.image}
                                    </code>
                                </div>
                                
                                {service.command && (
                                    <div>
                                        <h4 className="font-medium text-sm text-gray-900 dark:text-gray-100 mb-2">Command</h4>
                                        <code className="text-sm bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                                            {service.command}
                                        </code>
                                    </div>
                                )}
                                
                                {service.ports && service.ports.length > 0 && (
                                    <div>
                                        <h4 className="font-medium text-sm text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-1">
                                            <Globe size={14} />
                                            Ports
                                        </h4>
                                        <div className="space-y-1">
                                            {service.ports.map((port, index) => (
                                                <div key={index} className="text-sm">
                                                    <Badge variant="secondary" className="text-xs">
                                                        {port.published}:{port.target} ({port.protocol})
                                                    </Badge>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                
                                {service.volumes && service.volumes.length > 0 && (
                                    <div>
                                        <h4 className="font-medium text-sm text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-1">
                                            <HardDrive size={14} />
                                            Volumes
                                        </h4>
                                        <div className="space-y-1">
                                            {service.volumes.map((volume, index) => (
                                                <div key={index} className="text-xs text-gray-600 dark:text-gray-400">
                                                    <div className="flex items-center gap-1">
                                                        {volume.read_only && <Lock size={12} />}
                                                        <span className="font-mono">
                                                            {volume.source} → {volume.target}
                                                        </span>
                                                        {volume.read_only && (
                                                            <Badge variant="outline" className="text-xs">RO</Badge>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}