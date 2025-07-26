import ServiceStatusProgressBar from '@/components/ServiceStatusProgressBar';
import StackStatusBadge from '@/components/StackStatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { Server, Stack } from '@/types/entities';
import { Container, Globe, HardDrive, Network, RefreshCw } from 'lucide-react';

interface StackOverviewProps {
    stack: Stack;
    server: Server;
    isRefreshing: boolean;
    onRefresh: () => void;
}

export default function StackOverview({ stack, server, isRefreshing, onRefresh }: StackOverviewProps) {
    return (
        <div className="space-y-6">
            <div className="rounded-xl border bg-gradient-to-r from-background via-background to-muted/20 p-6 shadow-sm">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="flex items-start gap-4">
                        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-accent/20">
                            <Container className="h-7 w-7 text-primary" />
                        </div>
                        <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-3">
                                <h1 className="text-3xl font-bold">{stack.name}</h1>
                                <StackStatusBadge stack={stack} />
                            </div>
                            <p className="mt-2 font-mono text-sm text-muted-foreground">
                                {stack.path} on {server.display_name}
                            </p>
                            <div className="mt-1 text-xs text-muted-foreground">
                                {server.https ? 'https' : 'http'}://{server.hostname}:{server.port}
                            </div>
                        </div>
                    </div>
                    <Button onClick={onRefresh} disabled={isRefreshing} size="lg" className="shrink-0 gap-2">
                        <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 shadow-sm">
                        <CardContent className="flex items-center justify-between p-5">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20">
                                    <Container className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Services</p>
                                    <p className="text-2xl font-bold">
                                        {stack.service_status_summary
                                            ? `${stack.service_status_summary.running}/${stack.service_status_summary.total}`
                                            : stack.service_count}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-green-500/20 bg-gradient-to-br from-green-500/5 to-green-500/10 shadow-sm">
                        <CardContent className="flex items-center justify-between p-5">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/20">
                                    <Globe className="h-5 w-5 text-green-600" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Ports</p>
                                    <p className="text-2xl font-bold">{stack.port_mappings.length}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-orange-500/20 bg-gradient-to-br from-orange-500/5 to-orange-500/10 shadow-sm">
                        <CardContent className="flex items-center justify-between p-5">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/20">
                                    <HardDrive className="h-5 w-5 text-orange-600" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Volumes</p>
                                    <p className="text-2xl font-bold">{stack.volume_mappings.length}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-purple-500/10 shadow-sm">
                        <CardContent className="flex items-center justify-between p-5">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/20">
                                    <Network className="h-5 w-5 text-purple-600" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Networks</p>
                                    <p className="text-2xl font-bold">{Object.keys(stack.networks).length}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {stack.service_status_summary && (
                    <div className="mt-6">
                        <ServiceStatusProgressBar serviceStatusSummary={stack.service_status_summary} isLoading={false} />
                    </div>
                )}
            </div>
        </div>
    );
}
