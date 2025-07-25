import ServiceGrid from '@/components/ServiceGrid';
import ServiceStatusProgressBar from '@/components/ServiceStatusProgressBar';
import StackStatusBadge from '@/components/StackStatusBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import type { Server, Stack } from '@/types/entities';
import { Link } from '@inertiajs/react';
import { ArrowRight, Container, ExternalLink, Globe, HardDrive, Network } from 'lucide-react';

interface StackCardProps {
    stack: Stack & { isLoadingStatus?: boolean };
    server: Server;
}

export default function StackCard({ stack, server }: StackCardProps) {
    return (
        <Card className="group overflow-hidden shadow-sm transition-all duration-300 hover:shadow-lg">
            <Link href={`/servers/${server.id}/stacks/${stack.name}`} className="block">
                <CardHeader className="pb-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-accent/20">
                                <Container className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <CardTitle className="text-lg transition-colors group-hover:text-primary">{stack.name}</CardTitle>
                                    <StackStatusBadge stack={stack} size="sm" />
                                </div>
                                <p className="mt-1 font-mono text-xs text-muted-foreground">{stack.path}</p>
                            </div>
                        </div>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <ExternalLink className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
                        </Button>
                    </div>
                </CardHeader>
                <Separator className="mx-6" />
                <CardContent className="pt-4">
                    <div className="space-y-4">
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <Container className="h-4 w-4 text-primary lg:h-5 lg:w-5" />
                                <h3 className="text-sm font-semibold">Services</h3>
                                <Badge variant="secondary" className="text-xs">
                                    {stack.service_count}
                                </Badge>
                            </div>

                            <ServiceStatusProgressBar serviceStatusSummary={stack.service_status_summary} isLoading={stack.isLoadingStatus} />

                            <ServiceGrid stack={stack} />
                        </div>

                        {stack.volume_mappings.length > 0 && (
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <HardDrive className="h-4 w-4 text-orange-500" />
                                    <h3 className="text-sm font-semibold">Volumes</h3>
                                    <Badge variant="secondary" className="text-xs">
                                        {stack.volume_mappings.length}
                                    </Badge>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {stack.volume_mappings.slice(0, 12).map((volume, index) => (
                                        <div
                                            key={index}
                                            className="flex items-center gap-2 rounded-md border border-border/30 bg-background px-3 py-2 text-sm shadow-sm transition-all duration-200 hover:bg-accent/50"
                                            title={`${volume.source} → ${volume.target} ${volume.read_only ? '(read-only)' : ''}`}
                                        >
                                            <div className="max-w-[120px] truncate font-mono text-xs">
                                                {volume.source?.split('/').pop() || 'Unknown'}
                                            </div>
                                            <ArrowRight className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                                            <div className="max-w-[120px] truncate font-mono text-xs">
                                                {volume.target?.split('/').pop() || 'Unknown'}
                                            </div>
                                            {volume.read_only && (
                                                <Badge variant="outline" className="h-5 min-h-5 px-2 py-0.5 text-[10px] whitespace-nowrap">
                                                    RO
                                                </Badge>
                                            )}
                                        </div>
                                    ))}
                                    {stack.volume_mappings.length > 12 && (
                                        <Badge variant="outline" className="h-7 min-h-7 px-2.5 text-xs">
                                            +{stack.volume_mappings.length - 12} more
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <Network className="h-4 w-4 text-blue-500" />
                                <h3 className="text-sm font-semibold">Ports</h3>
                                <Badge variant="secondary" className="text-xs">
                                    {stack.port_mappings.length}
                                </Badge>
                            </div>
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                {stack.port_mappings.length > 0 ? (
                                    stack.port_mappings.map((port, index) => (
                                        <div
                                            key={index}
                                            className="flex items-center justify-between rounded-md border border-border/30 bg-background px-3 py-2 font-mono text-sm"
                                        >
                                            <span className="flex items-center gap-2">
                                                <Globe className="h-3.5 w-3.5 text-blue-500" />
                                                {port.published}:{port.target}
                                            </span>
                                            <Badge variant="outline" className="h-6 min-h-6 px-2 py-0.5 text-xs">
                                                {port.protocol}
                                            </Badge>
                                        </div>
                                    ))
                                ) : (
                                    <div className="rounded-md border border-border/30 bg-background px-3 py-2 text-center text-sm text-muted-foreground">
                                        No ports configured
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Link>
        </Card>
    );
}
