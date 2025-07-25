import FileManager from '@/components/file-manager';
import ProgressModal from '@/components/ProgressModal';
import StackServices from '@/components/StackServices';
import StackStatusBadge from '@/components/StackStatusBadge';
import TerminalSession from '@/components/TerminalSession';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import type { LogsResponse, Server, Stack, UserPermissions } from '@/types/entities';
import { apiGet } from '@/utils/api';
import { Head, router } from '@inertiajs/react';
import { AlertCircle, Container, Download, FileText, Globe, HardDrive, Network, RefreshCw, Terminal } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

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
    const [terminalSessions, setTerminalSessions] = useState<{ id: string; service: string; shell: string }[]>([]);
    const [terminalService, setTerminalService] = useState<string>('');
    const [terminalShell, setTerminalShell] = useState<string>('auto');
    const prevLogOptionsRef = useRef({ selectedService, logTail });

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/dashboard' },
        { title: server.display_name, href: `/servers/${server.id}/stacks` },
        { title: stack.name, href: `/servers/${server.id}/stacks/${stack.name}` },
    ];

    const refreshStack = () => {
        setIsRefreshing(true);
        router.reload({
            onFinish: () => setIsRefreshing(false),
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
        const prev = prevLogOptionsRef.current;
        const hasOptionsChanged = prev.selectedService !== selectedService || prev.logTail !== logTail;

        if (logs !== null && hasOptionsChanged) {
            fetchLogs();
        }

        prevLogOptionsRef.current = { selectedService, logTail };
    }, [selectedService, logTail, logs, fetchLogs]);

    const bringStackUp = async (services?: string[], build?: boolean) => {
        if (showProgressModal) {
            return;
        }

        const params = new URLSearchParams({
            services: services?.join(',') || '',
        });

        if (build) {
            params.set('build', 'true');
        }

        const streamUrl = `/api/servers/${server.id}/stacks/${stack.name}/up/stream?${params}`;
        setProgressUrl(streamUrl);
        setProgressTitle(`Starting Stack: ${stack.name}${build ? ' (with --build)' : ''}`);
        setShowProgressModal(true);
    };

    const bringStackDown = async (services?: string[]) => {
        if (showProgressModal) {
            return;
        }

        const params = new URLSearchParams({
            services: services?.join(',') || '',
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

    const openTerminalSession = () => {
        if (!terminalService) return;

        const sessionId = `${terminalService}-${terminalShell}-${Date.now()}`;
        setTerminalSessions((prev) => [...prev, { id: sessionId, service: terminalService, shell: terminalShell }]);
        setTerminalService('');
    };

    const closeTerminalSession = (sessionId: string) => {
        setTerminalSessions((prev) => prev.filter((session) => session.id !== sessionId));
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`${stack.name} - ${server.display_name}`} />

            <div className="space-y-6">
                {/* Modern Header */}
                <div className="rounded-xl border bg-gradient-to-r from-background via-background to-muted/20 p-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-accent/20">
                                <Container className="h-6 w-6 text-primary" />
                            </div>
                            <div>
                                <h1 className="flex items-center gap-3 text-3xl font-bold">
                                    {stack.name}
                                    <StackStatusBadge stack={stack} />
                                </h1>
                                <p className="mt-1 font-mono text-muted-foreground">
                                    {stack.path} on {server.display_name}
                                </p>
                            </div>
                        </div>
                        <Button onClick={refreshStack} disabled={isRefreshing} variant="outline" size="lg">
                            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                    </div>

                    {/* Stack Stats */}
                    <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="rounded-lg border bg-background/50 p-4">
                            <div className="flex items-center gap-3">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
                                    <Container className="h-4 w-4 text-blue-500" />
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Services</p>
                                    <p className="text-xl font-bold">
                                        {stack.service_status_summary
                                            ? `${stack.service_status_summary.running}/${stack.service_status_summary.total}`
                                            : stack.service_count}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {stack.port_mappings.length > 0 && (
                            <div className="rounded-lg border bg-background/50 p-4">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500/10">
                                        <Globe className="h-4 w-4 text-green-500" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Exposed Ports</p>
                                        <p className="text-xl font-bold">{stack.port_mappings.length}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {stack.volume_mappings.length > 0 && (
                            <div className="rounded-lg border bg-background/50 p-4">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10">
                                        <HardDrive className="h-4 w-4 text-purple-500" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Volumes</p>
                                        <p className="text-xl font-bold">{stack.volume_mappings.length}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {Object.keys(stack.networks).length > 0 && (
                            <div className="rounded-lg border bg-background/50 p-4">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/10">
                                        <Network className="h-4 w-4 text-orange-500" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Networks</p>
                                        <p className="text-xl font-bold">{Object.keys(stack.networks).length}</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Parsing Error Alert */}
                {!stack.parsed_successfully && (
                    <Card className="border-destructive/50 bg-destructive/5">
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-3">
                                <AlertCircle className="h-5 w-5 text-destructive" />
                                <span className="font-medium text-destructive">
                                    This stack has parsing errors and may not be functioning correctly.
                                </span>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Modern Tabbed Interface */}
                <Tabs defaultValue="services" className="w-full">
                    <TabsList className="grid w-full grid-cols-3 lg:grid-cols-4">
                        <TabsTrigger value="services" className="flex items-center gap-2">
                            <Container className="h-4 w-4" />
                            Services
                        </TabsTrigger>
                        <TabsTrigger value="networks" className="flex items-center gap-2">
                            <Network className="h-4 w-4" />
                            Networks
                        </TabsTrigger>
                        <TabsTrigger value="logs" className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            Logs
                        </TabsTrigger>
                        {userPermissions.filemanager_access && (
                            <TabsTrigger value="files" className="flex items-center gap-2">
                                <FileText className="h-4 w-4" />
                                Files
                            </TabsTrigger>
                        )}
                    </TabsList>

                    <TabsContent value="services" className="mt-6">
                        <StackServices
                            stack={stack}
                            userPermissions={userPermissions}
                            isOperating={showProgressModal}
                            isRefreshing={isRefreshing}
                            onStartService={bringStackUp}
                            onStopService={bringStackDown}
                        />
                    </TabsContent>

                    <TabsContent value="networks" className="mt-6">
                        {Object.keys(stack.networks).length > 0 ? (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Network size={20} />
                                        Networks ({Object.keys(stack.networks).length})
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        {Object.entries(stack.networks).map(([networkName, network]) => (
                                            <div key={networkName} className="rounded-lg border border-border p-4">
                                                <div className="flex items-center justify-between">
                                                    <h3 className="text-lg font-medium">{networkName}</h3>
                                                    <code className="rounded bg-muted px-3 py-1 text-sm">
                                                        {((network as Record<string, unknown>)?.name as string) || networkName}
                                                    </code>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        ) : (
                            <Card>
                                <CardContent className="py-12 text-center">
                                    <Network className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                                    <p className="text-muted-foreground">No networks configured for this stack</p>
                                </CardContent>
                            </Card>
                        )}
                    </TabsContent>

                    <TabsContent value="logs" className="mt-6">
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <CardTitle className="flex items-center gap-2">
                                        <FileText className="h-5 w-5" />
                                        Container Logs
                                        {logs && <span className="text-sm font-normal text-muted-foreground">({logs.lines} lines)</span>}
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
                                        <Button onClick={fetchLogs} disabled={isLoadingLogs} variant="outline">
                                            <RefreshCw className={`mr-2 h-4 w-4 ${isLoadingLogs ? 'animate-spin' : ''}`} />
                                            Load Logs
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {logs ? (
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between text-sm text-muted-foreground">
                                            <span>
                                                {logs.service ? `Service: ${logs.service}` : 'All services'} • Last {logTail} lines
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
                                                <Download size={14} className="mr-2" />
                                                Download
                                            </Button>
                                        </div>
                                        <div className="overflow-hidden rounded-xl border border-border/20 bg-gradient-to-br from-background to-muted/5 shadow-lg">
                                            <div className="border-b border-border/20 bg-gradient-to-r from-muted/40 to-muted/20 px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className="h-3 w-3 rounded-full bg-red-500 shadow-sm"></div>
                                                        <div className="h-3 w-3 rounded-full bg-yellow-500 shadow-sm"></div>
                                                        <div className="h-3 w-3 rounded-full bg-green-500 shadow-sm"></div>
                                                    </div>
                                                    <span className="ml-2 font-mono text-sm font-medium text-foreground">
                                                        Container Logs Terminal
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="max-h-[70vh] overflow-auto bg-gradient-to-br from-slate-950 to-slate-900 p-6">
                                                <pre className="font-mono text-sm leading-relaxed whitespace-pre-wrap text-slate-100">
                                                    {logs.logs || 'No logs available'}
                                                </pre>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="py-12 text-center text-muted-foreground">
                                        <FileText className="mx-auto mb-4 h-12 w-12 opacity-50" />
                                        <p>Click "Load Logs" to view container logs</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {userPermissions.filemanager_access && (
                        <TabsContent value="files" className="mt-6">
                            <FileManager
                                serverId={server.id}
                                stackName={stack.name}
                                title="Stack Files"
                                canWrite={userPermissions.filemanager_write}
                            />
                        </TabsContent>
                    )}
                </Tabs>

                {/* Persistent Terminal Section */}
                {userPermissions.exec && (
                    <Card className="mt-6">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Terminal className="h-5 w-5" />
                                Interactive Terminal
                                {terminalSessions.length > 0 && (
                                    <span className="text-sm font-normal text-muted-foreground">
                                        ({terminalSessions.length} active session{terminalSessions.length !== 1 ? 's' : ''})
                                    </span>
                                )}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                                            <Terminal className="h-4 w-4 text-primary" />
                                        </div>
                                        <div>
                                            <h3 className="text-base font-semibold">Launch New Terminal</h3>
                                            <p className="text-xs text-muted-foreground">
                                                Open shell sessions in service containers - terminals persist while navigating tabs
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-3">
                                    <div className="flex-1">
                                        <Select value={terminalService} onValueChange={setTerminalService}>
                                            <SelectTrigger className="font-mono text-sm">
                                                <SelectValue placeholder="Choose service..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {stack.service_names.map((service) => (
                                                    <SelectItem key={service} value={service} className="font-mono">
                                                        <div className="flex items-center gap-2">
                                                            <div className="h-2 w-2 rounded-full bg-green-500/60"></div>
                                                            {service}
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="w-32">
                                        <Select value={terminalShell} onValueChange={setTerminalShell}>
                                            <SelectTrigger className="font-mono text-sm">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="auto" className="font-mono">
                                                    auto
                                                </SelectItem>
                                                <SelectItem value="bash" className="font-mono">
                                                    bash
                                                </SelectItem>
                                                <SelectItem value="sh" className="font-mono">
                                                    sh
                                                </SelectItem>
                                                <SelectItem value="zsh" className="font-mono">
                                                    zsh
                                                </SelectItem>
                                                <SelectItem value="fish" className="font-mono">
                                                    fish
                                                </SelectItem>
                                                <SelectItem value="dash" className="font-mono">
                                                    dash
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <Button onClick={openTerminalSession} disabled={!terminalService} className="gap-2">
                                        <Terminal className="h-4 w-4" />
                                        Launch Terminal
                                    </Button>
                                </div>

                                {/* Active Terminal Sessions */}
                                {terminalSessions.length > 0 && (
                                    <div className="space-y-4">
                                        <div className="border-t border-border/20" />
                                        {terminalSessions.map((session, index) => (
                                            <div key={session.id} className="space-y-2">
                                                {index > 0 && <div className="border-t border-border/10" />}
                                                <TerminalSession
                                                    serverId={server.id}
                                                    stackName={stack.name}
                                                    service={session.service}
                                                    shell={session.shell}
                                                    onClose={() => closeTerminalSession(session.id)}
                                                    className="w-full"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                )}
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
