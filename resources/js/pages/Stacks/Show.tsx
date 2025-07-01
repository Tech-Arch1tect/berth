import { useState, useEffect } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Container, Network, HardDrive, Settings, Globe, Lock, RefreshCw, FileText, Download, Play, Square, Terminal } from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import FileManager from '@/components/file-manager';

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
    access: boolean;
    filemanager_access: boolean;
    filemanager_write: boolean;
    'start-stop': boolean;
    exec: boolean;
}

interface Props {
    server: Server;
    stack: Stack;
    userPermissions: UserPermissions;
}

interface LogsResponse {
    stack: string;
    service?: string;
    lines: number;
    logs: string;
}

export default function StackShow({ server, stack, userPermissions }: Props) {
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [logs, setLogs] = useState<LogsResponse | null>(null);
    const [isLoadingLogs, setIsLoadingLogs] = useState(false);
    const [selectedService, setSelectedService] = useState<string>('all');
    const [logTail, setLogTail] = useState<string>('100');
    const [isStarting, setIsStarting] = useState(false);
    const [isStopping, setIsStopping] = useState(false);
    const [execService, setExecService] = useState<string>('');
    const [execCommand, setExecCommand] = useState<string>('');
    const [execResult, setExecResult] = useState<any>(null);
    const [isExecuting, setIsExecuting] = useState(false);

    const refreshStack = () => {
        setIsRefreshing(true);
        router.reload({
            onFinish: () => setIsRefreshing(false)
        });
    };

    const fetchLogs = async () => {
        setIsLoadingLogs(true);
        try {
            const params = new URLSearchParams({ tail: logTail });
            if (selectedService !== 'all') {
                params.append('service', selectedService);
            }
            
            const response = await fetch(`/api/servers/${server.id}/stacks/${stack.name}/logs?${params}`);
            if (response.ok) {
                const logsData = await response.json();
                setLogs(logsData);
            } else {
                console.error('Failed to fetch logs:', response.statusText);
            }
        } catch (err) {
            console.error('Failed to fetch logs:', err);
        } finally {
            setIsLoadingLogs(false);
        }
    };

    // Auto-refresh logs when service or tail options change
    useEffect(() => {
        if (logs) {
            fetchLogs();
        }
    }, [selectedService, logTail]);

    const startStack = async (services?: string[]) => {
        setIsStarting(true);
        try {
            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
            const response = await fetch(`/api/servers/${server.id}/stacks/${stack.name}/up`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken || '',
                },
                body: JSON.stringify({ services: services || [] }),
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log('Stack started:', result);
                refreshStack();
            } else {
                const error = await response.json();
                console.error('Failed to start stack:', error);
            }
        } catch (err) {
            console.error('Failed to start stack:', err);
        } finally {
            setIsStarting(false);
        }
    };

    const stopStack = async (services?: string[]) => {
        setIsStopping(true);
        try {
            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
            const response = await fetch(`/api/servers/${server.id}/stacks/${stack.name}/down`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken || '',
                },
                body: JSON.stringify({ services: services || [] }),
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log('Stack stopped:', result);
                refreshStack();
            } else {
                const error = await response.json();
                console.error('Failed to stop stack:', error);
            }
        } catch (err) {
            console.error('Failed to stop stack:', err);
        } finally {
            setIsStopping(false);
        }
    };

    const executeCommand = async () => {
        if (!execService || !execCommand.trim()) {
            return;
        }

        setIsExecuting(true);
        setExecResult(null);
        
        try {
            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
            const response = await fetch(`/api/servers/${server.id}/stacks/${stack.name}/exec`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken || '',
                },
                body: JSON.stringify({ 
                    service: execService,
                    command: execCommand.trim().split(' ').filter(cmd => cmd.length > 0)
                }),
            });
            
            if (response.ok) {
                const result = await response.json();
                setExecResult(result);
            } else {
                const error = await response.json();
                setExecResult({ error: error.error || 'Command execution failed' });
            }
        } catch (err) {
            setExecResult({ error: `Failed to execute command: ${err}` });
        } finally {
            setIsExecuting(false);
        }
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
                    <div className="flex items-center gap-2">
                        {userPermissions['start-stop'] && (
                            <>
                                <Button
                                    onClick={() => startStack()}
                                    disabled={isStarting || isRefreshing}
                                    variant="default"
                                    size="sm"
                                >
                                    <Play className={`mr-2 h-4 w-4 ${isStarting ? 'animate-spin' : ''}`} />
                                    Up All
                                </Button>
                                <Button
                                    onClick={() => stopStack()}
                                    disabled={isStopping || isRefreshing}
                                    variant="destructive"
                                    size="sm"
                                >
                                    <Square className={`mr-2 h-4 w-4 ${isStopping ? 'animate-spin' : ''}`} />
                                    Down All
                                </Button>
                            </>
                        )}
                        <Button
                            onClick={refreshStack}
                            disabled={isRefreshing}
                            variant="outline"
                            size="sm"
                        >
                            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
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
                                    const serviceStatus = stack.service_status?.services?.find(s => {
                                        const containerName = s.name.toLowerCase();
                                        const searchService = serviceName.toLowerCase();
                                        const stackNameLower = stack.name.toLowerCase();
                                        const exactPattern = `${stackNameLower}-${searchService}-\\d+$`;
                                        const regex = new RegExp(exactPattern);
                                        return regex.test(containerName);
                                    });
                                    
                                    const isRunning = serviceStatus?.state === 'running';
                                    const displayState = serviceStatus?.state || 'stopped';
                                    
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
                                                                onClick={() => startStack([serviceName])}
                                                                disabled={isStarting || isRefreshing}
                                                                variant="outline"
                                                                size="sm"
                                                            >
                                                                <Play className="h-3 w-3" />
                                                            </Button>
                                                            <Button
                                                                onClick={() => stopStack([serviceName])}
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

                    {/* Logs */}
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <CardTitle className="flex items-center gap-2">
                                    <FileText size={20} />
                                    Container Logs
                                    {logs && (
                                        <span className="text-sm text-gray-500 dark:text-gray-400">
                                            ({logs.lines} lines)
                                        </span>
                                    )}
                                </CardTitle>
                                <div className="flex items-center gap-2">
                                    <Select value={selectedService} onValueChange={setSelectedService}>
                                        <SelectTrigger className="w-40">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Services</SelectItem>
                                            {stack.service_names.map((service) => (
                                                <SelectItem key={service} value={service}>
                                                    {service}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Select value={logTail} onValueChange={setLogTail}>
                                        <SelectTrigger className="w-24">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="50">50</SelectItem>
                                            <SelectItem value="100">100</SelectItem>
                                            <SelectItem value="200">200</SelectItem>
                                            <SelectItem value="500">500</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Button
                                        onClick={fetchLogs}
                                        disabled={isLoadingLogs}
                                        variant="outline"
                                        size="sm"
                                    >
                                        <RefreshCw className={`mr-2 h-4 w-4 ${isLoadingLogs ? 'animate-spin' : ''}`} />
                                        Load Logs
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {logs ? (
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center text-sm text-gray-600 dark:text-gray-400">
                                        <span>
                                            {logs.service ? `Service: ${logs.service}` : 'All services'} • 
                                            Last {logTail} lines
                                        </span>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                                const blob = new Blob([logs.logs], { type: 'text/plain' });
                                                const url = URL.createObjectURL(blob);
                                                const a = document.createElement('a');
                                                a.href = url;
                                                a.download = `${stack.name}${logs.service ? `-${logs.service}` : ''}-logs.txt`;
                                                a.click();
                                                URL.revokeObjectURL(url);
                                            }}
                                        >
                                            <Download size={14} />
                                        </Button>
                                    </div>
                                    <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-auto text-xs max-h-96 font-mono whitespace-pre-wrap">
                                        {logs.logs || 'No logs available'}
                                    </pre>
                                </div>
                            ) : (
                                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                                    <FileText className="mx-auto h-12 w-12 mb-4 opacity-50" />
                                    <p>Click "Load Logs" to view container logs</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Command Execution */}
                    {userPermissions.exec && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Terminal size={20} />
                                    Execute Command
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium mb-2">Service</label>
                                            <Select value={execService} onValueChange={setExecService}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select service" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {stack.service_names.map((service) => (
                                                        <SelectItem key={service} value={service}>
                                                            {service}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium mb-2">Command</label>
                                            <div className="flex gap-2">
                                                <Input
                                                    value={execCommand}
                                                    onChange={(e) => setExecCommand(e.target.value)}
                                                    placeholder="e.g., ls -la, cat /etc/hosts, whoami"
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' && !isExecuting && execService && execCommand.trim()) {
                                                            executeCommand();
                                                        }
                                                    }}
                                                />
                                                <Button
                                                    onClick={executeCommand}
                                                    disabled={isExecuting || !execService || !execCommand.trim()}
                                                    variant="default"
                                                >
                                                    <Terminal className={`mr-2 h-4 w-4 ${isExecuting ? 'animate-spin' : ''}`} />
                                                    Execute
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {execResult && (
                                        <div className="mt-4">
                                            <div className="flex justify-between items-center text-sm text-gray-600 dark:text-gray-400 mb-2">
                                                <span>
                                                    Command: {execResult.command || execCommand} 
                                                    {execResult.service && ` (${execResult.service})`}
                                                </span>
                                                {execResult.output && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => {
                                                            const blob = new Blob([execResult.output], { type: 'text/plain' });
                                                            const url = URL.createObjectURL(blob);
                                                            const a = document.createElement('a');
                                                            a.href = url;
                                                            a.download = `${stack.name}-${execResult.service || execService}-exec-output.txt`;
                                                            a.click();
                                                            URL.revokeObjectURL(url);
                                                        }}
                                                    >
                                                        <Download size={14} />
                                                    </Button>
                                                )}
                                            </div>
                                            {execResult.error ? (
                                                <pre className="bg-red-900 text-red-100 p-4 rounded-lg overflow-auto text-xs max-h-96 font-mono whitespace-pre-wrap">
                                                    Error: {execResult.error}
                                                </pre>
                                            ) : (
                                                <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-auto text-xs max-h-96 font-mono whitespace-pre-wrap">
                                                    {execResult.output || 'Command executed successfully (no output)'}
                                                </pre>
                                            )}
                                        </div>
                                    )}
                                    
                                    <div className="text-sm text-gray-500 dark:text-gray-400">
                                        <strong>Note:</strong> Commands are executed non-interactively in the selected service container.
                                        Use simple commands like <code>ls</code>, <code>ps</code>, <code>cat filename</code>, etc.
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* File Manager */}
                    {userPermissions.filemanager_access && (
                        <FileManager 
                            serverId={server.id}
                            stackName={stack.name}
                            title="Stack Files"
                        />
                    )}

                    {/* Raw Configuration */}
                    {userPermissions.filemanager_write && (
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