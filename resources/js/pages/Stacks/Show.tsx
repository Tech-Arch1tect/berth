import { useState, useEffect, useCallback } from 'react';
import { Head, router } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Container, Network, Settings, RefreshCw, FileText, Download, Terminal, AlertCircle, ChevronDown, ChevronRight, HardDrive } from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import FileManager from '@/components/file-manager';
import StackStatusBadge from '@/components/StackStatusBadge';
import StackServices from '@/components/StackServices';
import ProgressModal from '@/components/ProgressModal';
import type { Server, Stack, UserPermissions, LogsResponse } from '@/types/entities';
import { type BreadcrumbItem } from '@/types';
import { apiPost, apiGet } from '@/utils/api';

interface Props {
    server: Server;
    stack: Stack;
    userPermissions: UserPermissions;
}

export default function StackShow({ server, stack, userPermissions }: Props) {
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [logs, setLogs] = useState<LogsResponse | null>(null);
    const [isLoadingLogs, setIsLoadingLogs] = useState(false);
    const [selectedService, setSelectedService] = useState<string>('all');
    const [logTail, setLogTail] = useState<string>('100');
    const [showProgressModal, setShowProgressModal] = useState(false);
    const [progressUrl, setProgressUrl] = useState<string>('');
    const [progressTitle, setProgressTitle] = useState<string>('');
    const [execService, setExecService] = useState<string>('');
    const [execCommand, setExecCommand] = useState<string>('');
    const [execResult, setExecResult] = useState<{command?: string, service?: string, output?: string, error?: string} | null>(null);
    const [isExecuting, setIsExecuting] = useState(false);
    const [openSections, setOpenSections] = useState<Set<string>>(new Set(['services']));

    const toggleSection = (section: string) => {
        const newOpenSections = new Set(openSections);
        if (newOpenSections.has(section)) {
            newOpenSections.delete(section);
        } else {
            newOpenSections.add(section);
        }
        setOpenSections(newOpenSections);
    };

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/dashboard' },
        { title: server.display_name, href: `/servers/${server.id}/stacks` },
        { title: stack.name, href: `/servers/${server.id}/stacks/${stack.name}` },
    ];

    const refreshStack = () => {
        setIsRefreshing(true);
        router.reload({
            onFinish: () => setIsRefreshing(false)
        });
    };

    const fetchLogs = useCallback(async () => {
        setIsLoadingLogs(true);
        try {
            const params = new URLSearchParams({ tail: logTail });
            if (selectedService !== 'all') {
                params.append('service', selectedService);
            }
            
            const response = await apiGet<LogsResponse>(`/api/servers/${server.id}/stacks/${stack.name}/logs?${params}`);
            if (response.success) {
                setLogs(response.data || null);
            } else {
                console.error('Failed to fetch logs:', response.error);
            }
        } catch (err) {
            console.error('Failed to fetch logs:', err);
        } finally {
            setIsLoadingLogs(false);
        }
    }, [server.id, stack.name, selectedService, logTail]);

    // Auto-refresh logs when service or tail options change
    useEffect(() => {
        if (logs) {
            fetchLogs();
        }
    }, [logs, selectedService, logTail, fetchLogs]);

    const bringStackUp = async (services?: string[]) => {
        if (showProgressModal) {
            return;
        }
        
        const params = new URLSearchParams({
            services: services?.join(',') || ''
        });
        
        const streamUrl = `/api/servers/${server.id}/stacks/${stack.name}/up/stream?${params}`;
        setProgressUrl(streamUrl);
        setProgressTitle(`Starting Stack: ${stack.name}`);
        setShowProgressModal(true);
    };

    const bringStackDown = async (services?: string[]) => {
        if (showProgressModal) {
            return;
        }
        
        const params = new URLSearchParams({
            services: services?.join(',') || ''
        });
        
        const streamUrl = `/api/servers/${server.id}/stacks/${stack.name}/down/stream?${params}`;
        setProgressUrl(streamUrl);
        setProgressTitle(`Stopping Stack: ${stack.name}`);
        setShowProgressModal(true);
    };

    const handleProgressComplete = (success: boolean) => {
        if (success) {
            refreshStack();
        }
    };

    const handleProgressClose = () => {
        setShowProgressModal(false);
    };

    const executeCommand = async () => {
        if (!execService || !execCommand.trim()) {
            return;
        }

        setIsExecuting(true);
        setExecResult(null);
        
        try {
            const response = await apiPost(`/api/servers/${server.id}/stacks/${stack.name}/exec`, {
                service: execService,
                command: execCommand.trim().split(' ').filter(cmd => cmd.length > 0)
            });
            
            if (response.success) {
                setExecResult(response.data as {command?: string, service?: string, output?: string, error?: string});
            } else {
                setExecResult({ error: response.error || 'Command execution failed' });
            }
        } catch (err) {
            setExecResult({ error: `Failed to execute command: ${err}` });
        } finally {
            setIsExecuting(false);
        }
    };


    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`${stack.name} - ${server.display_name}`} />
            
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-primary/20 to-accent/20 rounded-lg flex items-center justify-center">
                            <Container className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold flex items-center gap-2">
                                {stack.name}
                                <StackStatusBadge stack={stack} />
                            </h1>
                            <p className="text-sm text-muted-foreground font-mono">
                                {stack.path} on {server.display_name}
                            </p>
                        </div>
                    </div>
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

                {!stack.parsed_successfully && (
                    <Card className="border-destructive/50 bg-destructive/5">
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-3">
                                <AlertCircle className="h-5 w-5 text-destructive" />
                                <span className="text-destructive font-medium">This stack has parsing errors and may not be functioning correctly.</span>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Stack Stats Overview */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center">
                                    <Container className="h-4 w-4 text-blue-500" />
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Services</p>
                                    <p className="text-2xl font-bold">
                                        {stack.service_status_summary ? 
                                            `${stack.service_status_summary.running}/${stack.service_status_summary.total}` : 
                                            stack.service_count
                                        }
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    
                    {stack.port_mappings.length > 0 && (
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-green-500/10 rounded-lg flex items-center justify-center">
                                        <Network className="h-4 w-4 text-green-500" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Exposed Ports</p>
                                        <p className="text-2xl font-bold">{stack.port_mappings.length}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                    
                    {stack.volume_mappings.length > 0 && (
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-purple-500/10 rounded-lg flex items-center justify-center">
                                        <HardDrive className="h-4 w-4 text-purple-500" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Volumes</p>
                                        <p className="text-2xl font-bold">{stack.volume_mappings.length}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                    
                    {Object.keys(stack.networks).length > 0 && (
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-orange-500/10 rounded-lg flex items-center justify-center">
                                        <Network className="h-4 w-4 text-orange-500" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Networks</p>
                                        <p className="text-2xl font-bold">{Object.keys(stack.networks).length}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>

                <div className="grid gap-6">
                    {/* Services */}
                    <StackServices
                        stack={stack}
                        userPermissions={userPermissions}
                        isOperating={showProgressModal}
                        isRefreshing={isRefreshing}
                        onStartService={bringStackUp}
                        onStopService={bringStackDown}
                    />

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
                                        <div key={networkName} className="border rounded-lg p-3 border-border">
                                            <div className="flex justify-between items-center">
                                                <h3 className="font-medium">{networkName}</h3>
                                                <code className="text-sm bg-muted px-2 py-1 rounded">
                                                    {(network as Record<string, unknown>)?.name as string || networkName}
                                                </code>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Container Logs */}
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0"
                                        onClick={() => toggleSection('logs')}
                                    >
                                        {openSections.has('logs') ? 
                                            <ChevronDown className="h-3 w-3" /> : 
                                            <ChevronRight className="h-3 w-3" />
                                        }
                                    </Button>
                                    <CardTitle className="flex items-center gap-2">
                                        <FileText className="h-5 w-5" />
                                        Container Logs
                                        {logs && (
                                            <span className="text-sm text-muted-foreground">
                                                ({logs.lines} lines)
                                            </span>
                                        )}
                                    </CardTitle>
                                </div>
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
                        {openSections.has('logs') && (
                            <CardContent>
                            {logs ? (
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center text-sm text-muted-foreground">
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
                                    <div className="border border-border rounded-lg overflow-hidden">
                                        <div className="bg-muted/50 px-3 py-2 border-b border-border">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                                                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                                                <span className="text-xs text-muted-foreground ml-2 font-mono">Container Logs</span>
                                            </div>
                                        </div>
                                        <div className="bg-card p-4 max-h-96 overflow-auto">
                                            <pre className="text-sm font-mono text-foreground whitespace-pre-wrap leading-relaxed">
                                                {logs.logs || 'No logs available'}
                                            </pre>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-8 text-muted-foreground">
                                    <FileText className="mx-auto h-12 w-12 mb-4 opacity-50" />
                                    <p>Click "Load Logs" to view container logs</p>
                                </div>
                            )}
                            </CardContent>
                        )}
                    </Card>

                    {/* Command Execution */}
                    {userPermissions.exec && (
                        <Card>
                            <CardHeader>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0"
                                        onClick={() => toggleSection('exec')}
                                    >
                                        {openSections.has('exec') ? 
                                            <ChevronDown className="h-3 w-3" /> : 
                                            <ChevronRight className="h-3 w-3" />
                                        }
                                    </Button>
                                    <CardTitle className="flex items-center gap-2">
                                        <Terminal className="h-5 w-5" />
                                        Execute Command
                                    </CardTitle>
                                </div>
                            </CardHeader>
                            {openSections.has('exec') && (
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
                                            <div className="flex justify-between items-center text-sm text-muted-foreground mb-2">
                                                <span>
                                                    Command: {execResult.command || execCommand} 
                                                    {execResult.service && ` (${execResult.service})`}
                                                </span>
                                                {execResult.output && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => {
                                                            const blob = new Blob([execResult.output || ''], { type: 'text/plain' });
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
                                            <div className="border border-border rounded-lg overflow-hidden">
                                                <div className="bg-muted/50 px-3 py-2 border-b border-border">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                                        <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                                                        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                                                        <span className="text-xs text-muted-foreground ml-2 font-mono">
                                                            {execResult.error ? 'Command Failed' : 'Command Output'}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className={`p-4 max-h-96 overflow-auto ${execResult.error ? 'bg-destructive/5' : 'bg-card'}`}>
                                                    <pre className={`text-sm font-mono whitespace-pre-wrap leading-relaxed ${execResult.error ? 'text-destructive' : 'text-foreground'}`}>
                                                        {execResult.error ? 
                                                            `Error: ${execResult.error}` : 
                                                            (execResult.output || 'Command executed successfully (no output)')
                                                        }
                                                    </pre>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    
                                    <div className="text-sm text-muted-foreground">
                                        <strong>Note:</strong> Commands are executed non-interactively in the selected service container.
                                        Use simple commands like <code>ls</code>, <code>ps</code>, <code>cat filename</code>, etc.
                                    </div>
                                </div>
                            </CardContent>
                            )}
                        </Card>
                    )}

                    {/* File Manager */}
                    {userPermissions.filemanager_access && (
                        <FileManager 
                            serverId={server.id}
                            stackName={stack.name}
                            title="Stack Files"
                            canWrite={userPermissions.filemanager_write}
                        />
                    )}

                    {/* Raw Configuration */}
                    {userPermissions.filemanager_write && (
                        <Card>
                            <CardHeader>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0"
                                        onClick={() => toggleSection('config')}
                                    >
                                        {openSections.has('config') ? 
                                            <ChevronDown className="h-3 w-3" /> : 
                                            <ChevronRight className="h-3 w-3" />
                                        }
                                    </Button>
                                    <CardTitle className="flex items-center gap-2">
                                        <Settings className="h-5 w-5" />
                                        Raw Configuration
                                    </CardTitle>
                                </div>
                            </CardHeader>
                            {openSections.has('config') && (
                            <CardContent>
                                <pre className="bg-muted p-4 rounded-lg overflow-auto text-xs">
                                    {JSON.stringify(stack, null, 2)}
                                </pre>
                            </CardContent>
                            )}
                        </Card>
                    )}
                </div>
            </div>

            <ProgressModal
                url={progressUrl}
                onComplete={handleProgressComplete}
                title={progressTitle}
                isOpen={showProgressModal}
                onClose={handleProgressClose}
            />
        </AppLayout>
    );
}