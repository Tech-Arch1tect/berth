import { useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Container, Network, HardDrive, Settings, Globe, Lock, RefreshCw } from 'lucide-react';
import AppLayout from '@/layouts/app-layout';

interface Server {
    id: number;
    display_name: string;
    hostname: string;
    port: number;
    https: boolean;
}

interface Service {
    command: string | null;
    entrypoint: string | null;
    image: string;
    networks: Record<string, any>;
    ports?: Array<{
        mode: string;
        target: number;
        published: string;
        protocol: string;
    }>;
    restart: string;
    volumes?: Array<{
        type: string;
        source: string;
        target: string;
        read_only: boolean;
    }>;
}

interface Stack {
    name: string;
    path: string;
    services: Record<string, Service>;
    networks: Record<string, any>;
    parsed_successfully: boolean;
    service_count: number;
    service_names: string[];
    port_mappings: Array<{
        service: string;
        published: string | null;
        target: number | null;
        protocol: string;
    }>;
    volume_mappings: Array<{
        service: string;
        source: string | null;
        target: string | null;
        type: string;
        read_only: boolean;
    }>;
    service_status?: {
        stack: string;
        services: Array<{
            name: string;
            command: string;
            state: string;
            ports: string;
        }> | null;
    };
    running_services_count?: number;
    total_services_count?: number;
    service_status_summary?: {
        running: number;
        stopped: number;
        total: number;
    };
    overall_status?: 'running' | 'stopped' | 'partial' | 'unknown';
}

interface UserPermissions {
    read: boolean;
    write: boolean;
    'start-stop': boolean;
}

interface Props {
    server: Server;
    stack: Stack;
    userPermissions: UserPermissions;
}

export default function StackShow({ server, stack, userPermissions }: Props) {
    const [isRefreshing, setIsRefreshing] = useState(false);

    const refreshStack = () => {
        setIsRefreshing(true);
        router.reload({
            onFinish: () => setIsRefreshing(false)
        });
    };

    const getStatusBadge = () => {
        if (!stack.parsed_successfully) {
            return <Badge variant="destructive">Parse Error</Badge>;
        }
        if (stack.service_count === 0) {
            return <Badge variant="secondary">No Services</Badge>;
        }
        
        // Show service status if available
        if (stack.overall_status) {
            switch (stack.overall_status) {
                case 'running':
                    return <Badge variant="default">Running</Badge>;
                case 'stopped':
                    return <Badge variant="outline">Stopped</Badge>;
                case 'partial':
                    return <Badge variant="secondary">Partial</Badge>;
                case 'unknown':
                default:
                    return <Badge variant="outline">Unknown</Badge>;
            }
        }
        
        return null;
    };

    return (
        <AppLayout>
            <Head title={`${stack.name} - ${server.display_name}`} />
            
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href={`/servers/${server.id}/stacks`}>
                            <Button variant="ghost" size="sm">
                                <ArrowLeft size={16} />
                            </Button>
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold flex items-center gap-2">
                                <Container size={24} />
                                {stack.name}
                                {getStatusBadge()}
                            </h1>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                {stack.path} on {server.display_name}
                            </p>
                        </div>
                    </div>
                    <Button
                        onClick={refreshStack}
                        disabled={isRefreshing}
                        variant="outline"
                    >
                        <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>

                {!stack.parsed_successfully && (
                    <Card className="border-red-200 dark:border-red-800">
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                                <Settings size={20} />
                                <span>This stack has parsing errors and may not be functioning correctly.</span>
                            </div>
                        </CardContent>
                    </Card>
                )}

                <div className="grid gap-6">
                    {/* Services */}
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
                                    // Find the runtime status for this service
                                    const serviceStatus = stack.service_status?.services?.find(s => 
                                        s.name.includes(serviceName)
                                    );
                                    
                                    return (
                                        <div key={serviceName} className="border rounded-lg p-4 dark:border-gray-700">
                                            <div className="flex justify-between items-start mb-3">
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-semibold text-lg">{serviceName}</h3>
                                                    {serviceStatus && (
                                                        <Badge 
                                                            variant={serviceStatus.state === 'running' ? 'default' : 'outline'}
                                                        >
                                                            {serviceStatus.state}
                                                        </Badge>
                                                    )}
                                                </div>
                                                <Badge variant="outline">{service.restart}</Badge>
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

                    {/* Networks */}
                    {Object.keys(stack.networks).length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Network size={20} />
                                    Networks ({Object.keys(stack.networks).length})
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {Object.entries(stack.networks).map(([networkName, network]) => (
                                        <div key={networkName} className="border rounded-lg p-3 dark:border-gray-700">
                                            <div className="flex justify-between items-center">
                                                <h3 className="font-medium">{networkName}</h3>
                                                <code className="text-sm bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                                                    {(network as any)?.name || networkName}
                                                </code>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Raw Configuration */}
                    {userPermissions.write && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Settings size={20} />
                                    Raw Configuration
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg overflow-auto text-xs">
                                    {JSON.stringify(stack, null, 2)}
                                </pre>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}