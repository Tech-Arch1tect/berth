import { Head, Link } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Container, Network, HardDrive, Settings, Globe, Lock } from 'lucide-react';
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
    const getStatusBadge = () => {
        if (!stack.parsed_successfully) {
            return <Badge variant="destructive">Parse Error</Badge>;
        }
        if (stack.service_count === 0) {
            return <Badge variant="secondary">No Services</Badge>;
        }
        return null;
    };

    return (
        <AppLayout>
            <Head title={`${stack.name} - ${server.display_name}`} />
            
            <div className="space-y-6">
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
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {Object.entries(stack.services).map(([serviceName, service]) => (
                                    <div key={serviceName} className="border rounded-lg p-4 dark:border-gray-700">
                                        <div className="flex justify-between items-start mb-3">
                                            <h3 className="font-semibold text-lg">{serviceName}</h3>
                                            <Badge variant="outline">{service.restart}</Badge>
                                        </div>
                                        
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
                                ))}
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