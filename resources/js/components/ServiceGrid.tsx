import { Badge } from '@/components/ui/badge';
import type { Stack } from '@/types/entities';
import { findServiceStatus } from '@/utils/stack-utils';

interface ServiceGridProps {
    stack: Stack & { isLoadingStatus?: boolean };
}

export default function ServiceGrid({ stack }: ServiceGridProps) {
    return (
        <div className="max-h-40 overflow-y-auto">
            {stack.isLoadingStatus ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="animate-pulse rounded-lg border bg-card p-3 shadow-sm">
                            <div className="space-y-2">
                                <div className="h-4 w-3/4 rounded bg-muted"></div>
                                <div className="h-3 w-1/2 rounded bg-muted"></div>
                                <div className="ml-auto h-5 w-16 rounded bg-muted"></div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {stack.service_names.slice(0, 12).map((service) => {
                        const serviceStatus = findServiceStatus(stack, service);
                        const isRunning = serviceStatus?.state === 'running';
                        const displayState = serviceStatus?.state || 'stopped';
                        const serviceConfig = stack.services[service];
                        const imageName = serviceConfig?.image || 'Unknown';

                        return (
                            <div
                                key={service}
                                className="rounded-lg border bg-card p-3 shadow-sm transition-all duration-200 hover:bg-accent/30 hover:shadow-md"
                            >
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex min-w-0 flex-1 items-center gap-2">
                                            <div
                                                className={`h-2 w-2 flex-shrink-0 rounded-full transition-all duration-300 ${isRunning ? 'bg-green-500' : 'bg-red-500'}`}
                                                style={{
                                                    boxShadow: isRunning ? '0 0 8px rgb(34 197 94 / 0.4)' : 'none',
                                                }}
                                            />
                                            <span className="truncate text-sm font-medium" title={service}>
                                                {service}
                                            </span>
                                            {/* IP Address Display - Now inline with service name */}
                                            {serviceStatus?.networks && serviceStatus.networks.length > 0 && (
                                                <div className="ml-2 flex flex-wrap gap-1">
                                                    {serviceStatus.networks.slice(0, 1).map((network, networkIndex) => (
                                                        <span
                                                            key={networkIndex}
                                                            className="inline-flex items-center rounded-md bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                                                            title={`${network.name}: ${network.ip_address}`}
                                                        >
                                                            {network.ip_address}
                                                        </span>
                                                    ))}
                                                    {serviceStatus.networks.length > 1 && (
                                                        <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                                                            +{serviceStatus.networks.length - 1}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <span
                                            className={`flex-shrink-0 rounded-full px-2 py-1 text-xs transition-all duration-200 ${isRunning ? 'bg-green-500/10 text-green-700 dark:text-green-400' : 'bg-red-500/10 text-red-700 dark:text-red-400'} font-medium`}
                                        >
                                            {displayState}
                                        </span>
                                    </div>
                                    <div className="truncate font-mono text-xs text-muted-foreground" title={imageName}>
                                        {imageName.split('/').pop()}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
            {!stack.isLoadingStatus && stack.service_names.length > 12 && (
                <div className="mt-3 text-center">
                    <Badge variant="outline" className="text-xs">
                        +{stack.service_names.length - 12} more services...
                    </Badge>
                </div>
            )}
        </div>
    );
}
