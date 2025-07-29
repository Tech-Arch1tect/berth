import FileManager from '@/components/file-manager';
import NetworkDetailsCard from '@/components/NetworkDetailsCard';
import ProgressModal from '@/components/ProgressModal';
import StackLogsTab from '@/components/StackLogsTab';
import StackOverview from '@/components/StackOverview';
import StackPortsCard from '@/components/StackPortsCard';
import StackServicesTab from '@/components/StackServicesTab';
import StackVolumesCard from '@/components/StackVolumesCard';
import TerminalSession from '@/components/TerminalSession';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useStackOperationSuccess } from '@/hooks/mutations/use-stack-mutations';
import { useServerStack } from '@/hooks/queries';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import type { Server, UserPermissions } from '@/types/entities';
import { Head } from '@inertiajs/react';
import { AlertCircle, Container, FileText, Globe, HardDrive, Network, RefreshCw, Terminal } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

interface Props {
    server: Server;
    stackName: string;
    userPermissions: UserPermissions;
}

export default function StackShow({ server, stackName, userPermissions }: Props) {
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [showProgressModal, setShowProgressModal] = useState(false);
    const [progressUrl, setProgressUrl] = useState<string>('');
    const [progressTitle, setProgressTitle] = useState<string>('');
    const [terminalSessions, setTerminalSessions] = useState<{ id: string; service: string; shell: string }[]>([]);
    const [terminalService, setTerminalService] = useState<string>('');
    const [terminalShell, setTerminalShell] = useState<string>('auto');

    const { data: stack, isLoading, refetch } = useServerStack(server.id, stackName, true);
    const { invalidateStackData } = useStackOperationSuccess(server.id, stackName);

    const breadcrumbs = useMemo(
        (): BreadcrumbItem[] => [
            { title: 'Dashboard', href: '/dashboard' },
            { title: server.display_name, href: `/servers/${server.id}/stacks` },
            { title: stackName, href: `/servers/${server.id}/stacks/${stackName}` },
        ],
        [server.display_name, server.id, stackName],
    );

    const refreshStack = useCallback(async () => {
        setIsRefreshing(true);
        try {
            await refetch();
        } finally {
            setIsRefreshing(false);
        }
    }, [refetch]);

    const bringStackUp = useCallback(
        async (services: string[] = [], build = false) => {
            if (showProgressModal) return;

            const params = new URLSearchParams({
                services: services.join(','),
            });

            if (build) {
                params.set('build', 'true');
            }

            const streamUrl = `/api/servers/${server.id}/stacks/${stackName}/up/stream?${params}`;
            setProgressUrl(streamUrl);
            setProgressTitle(`Starting Stack: ${stackName}${build ? ' (with --build)' : ''}`);
            setShowProgressModal(true);
        },
        [server.id, stackName, showProgressModal],
    );

    const bringStackDown = useCallback(
        async (services: string[] = []) => {
            if (showProgressModal) return;

            const params = new URLSearchParams({
                services: services.join(','),
            });

            const streamUrl = `/api/servers/${server.id}/stacks/${stackName}/down/stream?${params}`;
            setProgressUrl(streamUrl);
            setProgressTitle(`Stopping Stack: ${stackName}`);
            setShowProgressModal(true);
        },
        [server.id, stackName, showProgressModal],
    );

    const pullStack = useCallback(
        async (services: string[] = []) => {
            if (showProgressModal) return;

            const params = new URLSearchParams({
                services: services.join(','),
            });

            const streamUrl = `/api/servers/${server.id}/stacks/${stackName}/pull/stream?${params}`;
            setProgressUrl(streamUrl);
            setProgressTitle(`Pulling Images: ${stackName}`);
            setShowProgressModal(true);
        },
        [server.id, stackName, showProgressModal],
    );

    const handleProgressComplete = useCallback(
        (success: boolean) => {
            if (success) {
                invalidateStackData();
                refreshStack();
            }
        },
        [invalidateStackData, refreshStack],
    );

    const handleProgressClose = useCallback(() => {
        setShowProgressModal(false);
    }, []);

    const networkContent = useMemo(() => {
        if (!stack) return null;

        const networkEntries = Object.entries(stack.networks);

        if (networkEntries.length === 0) return null;

        return (
            <Card className="shadow-sm">
                <CardHeader>
                    <CardTitle className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500/20 to-purple-600/20">
                            <Network className="h-5 w-5 text-purple-600" />
                        </div>
                        <div>
                            <span className="text-xl">Networks</span>
                            <p className="text-sm font-normal text-muted-foreground">{networkEntries.length} networks configured</p>
                        </div>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-6">
                        {networkEntries.map(([networkName, network]) => (
                            <NetworkDetailsCard
                                key={networkName}
                                runtimeInfo={network.runtime_info!}
                                networkName={networkName}
                                serviceStatus={stack.service_status}
                                services={stack.services}
                                stackName={stack.name}
                            />
                        ))}
                    </div>
                </CardContent>
            </Card>
        );
    }, [stack]);

    const openTerminalSession = useCallback(() => {
        if (!terminalService) return;

        const sessionId = `${terminalService}-${terminalShell}-${Date.now()}`;
        setTerminalSessions((prev) => [...prev, { id: sessionId, service: terminalService, shell: terminalShell }]);
        setTerminalService('');
    }, [terminalService, terminalShell]);

    const closeTerminalSession = useCallback((sessionId: string) => {
        setTerminalSessions((prev) => prev.filter((session) => session.id !== sessionId));
    }, []);

    if (isLoading || !stack) {
        return (
            <AppLayout breadcrumbs={breadcrumbs}>
                <Head title={`${stackName} - ${server.display_name}`} />
                <div className="space-y-6">
                    <Card className="p-12 text-center">
                        <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-primary/10 to-accent/10">
                            <RefreshCw className="h-12 w-12 animate-spin text-muted-foreground" />
                        </div>
                        <h3 className="mb-3 text-xl font-semibold">Loading Stack Details</h3>
                        <p className="mx-auto max-w-md text-muted-foreground">
                            Fetching {stackName} details from {server.display_name}...
                        </p>
                    </Card>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`${stack.name} - ${server.display_name}`} />

            <div className="space-y-6">
                <StackOverview stack={stack} server={server} isRefreshing={isRefreshing} onRefresh={refreshStack} />

                {!stack.parsed_successfully && (
                    <Card className="border-destructive/50 bg-destructive/5 shadow-sm">
                        <CardContent className="p-6">
                            <div className="flex items-center gap-3">
                                <AlertCircle className="h-5 w-5 text-destructive" />
                                <span className="font-medium text-destructive">
                                    This stack has parsing errors and may not be functioning correctly.
                                </span>
                            </div>
                        </CardContent>
                    </Card>
                )}

                <Tabs defaultValue="services" className="w-full">
                    <TabsList className="grid h-12 w-full grid-cols-4 lg:grid-cols-6">
                        <TabsTrigger value="services" className="flex items-center gap-2 text-sm">
                            <Container className="h-4 w-4" />
                            Services
                        </TabsTrigger>
                        <TabsTrigger value="ports" className="flex items-center gap-2 text-sm">
                            <Globe className="h-4 w-4" />
                            Ports
                        </TabsTrigger>
                        <TabsTrigger value="volumes" className="flex items-center gap-2 text-sm">
                            <HardDrive className="h-4 w-4" />
                            Volumes
                        </TabsTrigger>
                        <TabsTrigger value="networks" className="flex items-center gap-2 text-sm">
                            <Network className="h-4 w-4" />
                            Networks
                        </TabsTrigger>
                        <TabsTrigger value="logs" className="flex items-center gap-2 text-sm">
                            <FileText className="h-4 w-4" />
                            Logs
                        </TabsTrigger>
                        {userPermissions.filemanager_access && (
                            <TabsTrigger value="files" className="flex items-center gap-2 text-sm">
                                <FileText className="h-4 w-4" />
                                Files
                            </TabsTrigger>
                        )}
                    </TabsList>
                    <TabsContent value="services" className="mt-6">
                        <StackServicesTab
                            stack={stack}
                            userPermissions={userPermissions}
                            isOperating={showProgressModal}
                            isRefreshing={isRefreshing}
                            onStartService={bringStackUp}
                            onStopService={bringStackDown}
                            onPullService={pullStack}
                        />
                    </TabsContent>
                    <TabsContent value="ports" className="mt-6">
                        <StackPortsCard portMappings={stack.port_mappings} />
                    </TabsContent>
                    <TabsContent value="volumes" className="mt-6">
                        <StackVolumesCard volumeMappings={stack.volume_mappings} services={stack.services} />
                    </TabsContent>
                    <TabsContent value="networks" className="mt-6">
                        {networkContent}
                    </TabsContent>
                    <TabsContent value="logs" className="mt-6">
                        <StackLogsTab server={server} stack={stack} />
                    </TabsContent>
                    {userPermissions.filemanager_access && (
                        <TabsContent value="files" className="mt-6">
                            <FileManager serverId={server.id} stackName={stackName} canWrite={!!userPermissions.filemanager_write} />
                        </TabsContent>
                    )}
                </Tabs>

                {userPermissions.exec && (
                    <Card className="mt-6 shadow-sm">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-green-500/20 to-green-600/20">
                                    <Terminal className="h-5 w-5 text-green-600" />
                                </div>
                                <div>
                                    <span className="text-xl">Interactive Terminal</span>
                                    {terminalSessions.length > 0 && (
                                        <p className="text-sm font-normal text-muted-foreground">
                                            {terminalSessions.length} active session{terminalSessions.length !== 1 ? 's' : ''}
                                        </p>
                                    )}
                                </div>
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
                                                {(stack?.service_names || []).map((service) => (
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
                                    <Button onClick={openTerminalSession} disabled={!terminalService} size="lg" className="gap-2">
                                        <Terminal className="h-4 w-4" />
                                        Launch Terminal
                                    </Button>
                                </div>

                                {terminalSessions.length > 0 && (
                                    <div className="space-y-4">
                                        <div className="border-t border-border/20" />
                                        {terminalSessions.map((session, index) => (
                                            <div key={session.id} className="space-y-2">
                                                {index > 0 && <div className="border-t border-border/10" />}
                                                <TerminalSession
                                                    serverId={server.id}
                                                    stackName={stackName}
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
