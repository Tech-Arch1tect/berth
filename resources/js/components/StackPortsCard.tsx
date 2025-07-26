import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Globe } from 'lucide-react';

interface StackPortsCardProps {
    portMappings: Array<{
        published: string | null;
        target: number | null;
        protocol: string;
    }>;
}

export default function StackPortsCard({ portMappings }: StackPortsCardProps) {
    return (
        <Card className="shadow-sm">
            <CardHeader>
                <CardTitle className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-green-500/20 to-green-600/20">
                        <Globe className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                        <span className="text-xl">Port Mappings</span>
                        <p className="text-sm font-normal text-muted-foreground">{portMappings.length} ports configured</p>
                    </div>
                </CardTitle>
            </CardHeader>
            <CardContent>
                {portMappings.length > 0 ? (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                        {portMappings.map((port, index) => (
                            <div
                                key={index}
                                className="flex items-center justify-between rounded-lg border border-border/30 bg-background p-4 transition-all hover:shadow-md"
                            >
                                <div className="flex items-center gap-3">
                                    <Globe className="h-4 w-4 text-green-600" />
                                    <code className="font-mono text-sm font-medium">
                                        {port.published}:{port.target}
                                    </code>
                                </div>
                                <span className="rounded border bg-muted px-2 py-0.5 text-xs text-muted-foreground">{port.protocol}</span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="py-16 text-center">
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted/50">
                            <Globe className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h3 className="mb-2 text-lg font-medium">No Ports</h3>
                        <p className="text-muted-foreground">No port mappings configured for this stack</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
