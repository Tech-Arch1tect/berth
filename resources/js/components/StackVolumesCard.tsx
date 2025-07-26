import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Container, HardDrive } from 'lucide-react';

interface VolumeMapping {
    service: string;
    source: string | null;
    target: string | null;
    type: string;
    read_only: boolean;
}

interface Service {
    volumes?: Array<{
        source: string;
        target: string;
        read_only: boolean;
    }>;
}

interface StackVolumesCardProps {
    volumeMappings: VolumeMapping[];
    services: Record<string, Service>;
}

export default function StackVolumesCard({ volumeMappings, services }: StackVolumesCardProps) {
    const volumeGroups = new Map<
        string,
        { source: string | null; read_only: boolean; services: { name: string; target: string; read_only: boolean }[] }
    >();

    volumeMappings.forEach((volume, index) => {
        const key = volume.source || `unnamed-${index}`;
        if (!volumeGroups.has(key)) {
            volumeGroups.set(key, {
                source: volume.source,
                read_only: volume.read_only,
                services: [],
            });
        }
        Object.entries(services).forEach(([serviceName, service]) => {
            service.volumes?.forEach((serviceVol) => {
                if (serviceVol.source === volume.source) {
                    const group = volumeGroups.get(key);
                    if (group && !group.services.find((s) => s.name === serviceName)) {
                        group.services.push({
                            name: serviceName,
                            target: serviceVol.target,
                            read_only: serviceVol.read_only,
                        });
                    }
                }
            });
        });
    });

    return (
        <Card className="shadow-sm">
            <CardHeader>
                <CardTitle className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500/20 to-orange-600/20">
                        <HardDrive className="h-5 w-5 text-orange-600" />
                    </div>
                    <div>
                        <span className="text-xl">Volume Mappings</span>
                        <p className="text-sm font-normal text-muted-foreground">{volumeMappings.length} volumes configured</p>
                    </div>
                </CardTitle>
            </CardHeader>
            <CardContent>
                {volumeMappings.length > 0 ? (
                    <div className="space-y-4">
                        {Array.from(volumeGroups.values()).map((volumeGroup, index) => (
                            <div key={index} className="rounded-lg border border-border/30 bg-background transition-all hover:shadow-md">
                                <div className="p-4">
                                    <div className="flex items-start gap-3">
                                        <HardDrive className="mt-0.5 h-5 w-5 flex-shrink-0 text-orange-600" />
                                        <div className="min-w-0 flex-1">
                                            <div className="mb-2">
                                                <code className="font-mono text-sm font-medium break-all">
                                                    {volumeGroup.source || 'Unnamed Volume'}
                                                </code>
                                            </div>
                                            <div className="mb-3 text-xs text-muted-foreground">
                                                {volumeGroup.read_only ? 'Read-only volume' : 'Read-write volume'}
                                            </div>
                                            {volumeGroup.services.length > 0 && (
                                                <div className="space-y-2">
                                                    <h4 className="text-sm font-medium text-muted-foreground">
                                                        Used by {volumeGroup.services.length} service{volumeGroup.services.length !== 1 ? 's' : ''}:
                                                    </h4>
                                                    <div className="space-y-2">
                                                        {volumeGroup.services.map((service, serviceIndex) => (
                                                            <div key={serviceIndex} className="flex items-center gap-3 rounded-md bg-muted/30 p-3">
                                                                <Container className="h-4 w-4 flex-shrink-0 text-primary" />
                                                                <div className="min-w-0 flex-1">
                                                                    <div className="mb-1 flex items-center gap-2">
                                                                        <span className="text-sm font-medium">{service.name}</span>
                                                                        {service.read_only && (
                                                                            <span className="rounded border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                                                                RO
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <code className="font-mono text-xs text-muted-foreground">
                                                                        mounted at {service.target}
                                                                    </code>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            {volumeGroup.services.length === 0 && (
                                                <div className="text-sm text-muted-foreground italic">No services currently using this volume</div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="py-16 text-center">
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted/50">
                            <HardDrive className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h3 className="mb-2 text-lg font-medium">No Volumes</h3>
                        <p className="text-muted-foreground">No volume mappings configured for this stack</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
